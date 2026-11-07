-- =============================================================================
-- Migration: vendas_apos_inicio_evento
-- -----------------------------------------------------------------------------
-- Vendas online continuam abertas depois que o evento comeca.
--
-- Regra nova:
--   * Campo "Encerramento das vendas online" (eventos.vendas_encerram_em)
--     VAZIO  = vendas online seguem abertas ate o evento ser encerrado
--              (REALIZADO: 12h apos o inicio ou botao "Encerrar evento").
--     PREENCHIDO = vendas online param nesse horario (pode ser antes OU
--              depois do inicio do evento).
--   * Ao comecar, o evento passa para EM_ANDAMENTO mas NAO fecha mais as
--     vendas (vendas_status continua como estava).
--   * criar_reserva aceita evento AGENDADO ou EM_ANDAMENTO.
--   * Pagina publica e lista de eventos publicos mostram eventos em andamento.
--
-- Nao altera: encerramento do evento (REALIZADO fecha vendas e lote), venda
-- manual do admin, botao abrir/fechar vendas do admin.
-- =============================================================================

-- 1) Limite de horario: so o campo proprio do evento (null = sem limite).
create or replace function private.limite_vendas_online(
  p_inicio_em timestamptz,
  p_vendas_encerram_em timestamptz
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_vendas_encerram_em;
$$;

comment on column public.eventos.vendas_encerram_em is
  'Horario em que as vendas online encerram (antes ou depois do inicio). Vazio = abertas ate o evento ser encerrado.';

-- 2) Inicio do evento: muda status, mas mantem as vendas como estao.
create or replace function private.processar_inicio_eventos(p_evento_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
  v_ts timestamptz;
  v_iniciados jsonb := '[]'::jsonb;
begin
  for v_rec in
    select e.id from public.eventos e
     where e.status = 'AGENDADO' and e.inicio_em <= now()
       and (p_evento_id is null or e.id = p_evento_id)
     order by e.id for update
  loop
    v_ts := now();
    update public.eventos set status = 'EM_ANDAMENTO' where id = v_rec.id;
    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_novos)
    values (null, 'EVENTO_INICIADO', 'eventos', v_rec.id,
      jsonb_build_object('status', 'EM_ANDAMENTO', 'iniciado_em', v_ts));
    v_iniciados := v_iniciados || jsonb_build_object('evento_id', v_rec.id);
  end loop;

  return jsonb_build_object('iniciados', jsonb_array_length(v_iniciados), 'eventos', v_iniciados);
end;
$$;

-- 3) Situacao de venda: evento em andamento pode estar DISPONIVEL.
create or replace function private.calcular_situacao_venda(p_evento_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_e public.eventos%rowtype;
  v_lote_id uuid;
  v_disp_e integer;
  v_disp_l integer;
  v_limite timestamptz;
begin
  select * into v_e from public.eventos e where e.id = p_evento_id;
  if not found then
    return null;
  end if;

  if v_e.status = 'CANCELADO' then
    return 'CANCELADO';
  end if;
  if v_e.status = 'REALIZADO' then
    return 'ENCERRADO';
  end if;
  if v_e.vendas_status <> 'ABERTAS' then
    return 'VENDAS_ENCERRADAS';
  end if;
  v_limite := private.limite_vendas_online(v_e.inicio_em, v_e.vendas_encerram_em);
  if v_limite is not null and now() >= v_limite then
    return 'VENDAS_ENCERRADAS';
  end if;

  select l.id into v_lote_id
    from public.lotes l
   where l.evento_id = v_e.id and l.status = 'ATIVO'
   limit 1;

  if v_lote_id is null then
    return 'SEM_LOTE';
  end if;

  v_disp_e := private.calcular_disponibilidade_evento(v_e.id);
  if v_disp_e <= 0 then
    return 'ESGOTADO';
  end if;

  v_disp_l := private.calcular_disponibilidade_lote(v_lote_id);
  if v_disp_l <= 0 then
    return 'ESGOTADO';
  end if;

  return 'DISPONIVEL';
end;
$$;

-- 4) Reserva online: aceita evento AGENDADO ou EM_ANDAMENTO.
create or replace function private.criar_reserva(
  p_evento_id uuid,
  p_comprador_nome text,
  p_comprador_telefone text,
  p_comprador_email text default null,
  p_nomes_participantes text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos%rowtype;
  v_lote public.lotes%rowtype;
  v_qtd integer;
  v_codigo text;
  v_valor_unitario numeric(10, 2);
  v_valor_total numeric(10, 2);
  v_reserva_expira_em timestamptz;
  v_pedido_id uuid;
  v_checkout_token uuid;
  v_disponivel_evento integer;
  v_disponivel_lote integer;
  v_ingressos jsonb;
  v_limite timestamptz;
begin
  if p_nomes_participantes is null then
    raise exception 'Lista de participantes obrigatoria' using errcode = '22004';
  end if;

  v_qtd := cardinality(p_nomes_participantes);

  if v_qtd < 1 or v_qtd > 10 then
    raise exception 'Quantidade de participantes deve estar entre 1 e 10 (recebido %)', v_qtd
      using errcode = '23514';
  end if;

  if exists (
    select 1 from unnest(p_nomes_participantes) as n(nome)
     where n.nome is null or btrim(n.nome) = ''
  ) then
    raise exception 'Nome de participante nao pode ser vazio' using errcode = '23514';
  end if;

  if p_comprador_nome is null or btrim(p_comprador_nome) = '' then
    raise exception 'comprador_nome obrigatorio' using errcode = '23514';
  end if;

  if p_comprador_telefone is null or btrim(p_comprador_telefone) = '' then
    raise exception 'comprador_telefone obrigatorio' using errcode = '23514';
  end if;

  select * into v_evento
    from public.eventos e
   where e.id = p_evento_id
   for update;

  if not found then
    raise exception 'Evento % nao encontrado', p_evento_id using errcode = '23503';
  end if;

  if v_evento.status not in ('AGENDADO', 'EM_ANDAMENTO') then
    raise exception 'Evento % nao esta com vendas disponiveis (status=%)', p_evento_id, v_evento.status
      using errcode = '23514';
  end if;

  if v_evento.publicacao_status <> 'PUBLICADO' then
    raise exception 'Evento % nao esta PUBLICADO (publicacao=%)', p_evento_id, v_evento.publicacao_status
      using errcode = '23514';
  end if;

  if v_evento.vendas_status <> 'ABERTAS' then
    raise exception 'Vendas encerradas para o evento % (vendas=%)', p_evento_id, v_evento.vendas_status
      using errcode = '23514';
  end if;

  v_limite := private.limite_vendas_online(v_evento.inicio_em, v_evento.vendas_encerram_em);
  if v_limite is not null and now() >= v_limite then
    raise exception 'Vendas online encerradas para o evento %', p_evento_id using errcode = '23514';
  end if;

  select * into v_lote
    from public.lotes l
   where l.evento_id = p_evento_id
     and l.status = 'ATIVO'
   for update;

  if not found then
    raise exception 'Nenhum lote ATIVO para o evento %', p_evento_id using errcode = '23514';
  end if;

  v_disponivel_evento := private.calcular_disponibilidade_evento(p_evento_id);
  if v_disponivel_evento < v_qtd then
    raise exception 'Estoque insuficiente no evento (disponivel=%, solicitado=%)',
      v_disponivel_evento, v_qtd using errcode = '23514';
  end if;

  v_disponivel_lote := private.calcular_disponibilidade_lote(v_lote.id);
  if v_disponivel_lote < v_qtd then
    raise exception 'Limite do lote insuficiente (disponivel=%, solicitado=%)',
      v_disponivel_lote, v_qtd using errcode = '23514';
  end if;

  v_codigo := 'GZ' || nextval('public.seq_pedido_codigo')::text;
  v_valor_unitario := v_lote.preco;
  v_valor_total := v_lote.preco * v_qtd;
  v_reserva_expira_em := now() + interval '30 minutes';

  insert into public.pedidos (
    evento_id, lote_id, codigo,
    comprador_nome, comprador_telefone, comprador_email,
    quantidade, tipo_preco, valor_unitario, valor_total,
    status, reserva_expira_em
  ) values (
    p_evento_id, v_lote.id, v_codigo,
    p_comprador_nome, p_comprador_telefone, p_comprador_email,
    v_qtd, 'LOTE', v_valor_unitario, v_valor_total,
    'RESERVADO', v_reserva_expira_em
  )
  returning id, checkout_token into v_pedido_id, v_checkout_token;

  insert into public.ingressos (
    pedido_id, evento_id, lote_id, codigo,
    participante_nome, valor_unitario, qr_token, status
  )
  select
    v_pedido_id, p_evento_id, v_lote.id,
    v_codigo || '-' || lpad(t.pos::text, 2, '0'),
    btrim(t.nome),
    v_valor_unitario,
    gen_random_uuid()::text,
    'RESERVADO'
  from unnest(p_nomes_participantes) with ordinality as t(nome, pos);

  perform private.processar_virada_lote_esgotamento(p_evento_id);

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'id', i.id,
               'codigo', i.codigo,
               'participante_nome', i.participante_nome
             ) order by i.codigo
           ),
           '[]'::jsonb
         )
    into v_ingressos
    from public.ingressos i
   where i.pedido_id = v_pedido_id;

  return jsonb_build_object(
    'pedido_id', v_pedido_id,
    'codigo_pedido', v_codigo,
    'checkout_token', v_checkout_token,
    'evento_id', p_evento_id,
    'lote_id', v_lote.id,
    'quantidade', v_qtd,
    'valor_unitario', v_valor_unitario,
    'valor_total', v_valor_total,
    'reserva_expira_em', v_reserva_expira_em,
    'status', 'RESERVADO',
    'ingressos', v_ingressos
  );
end;
$$;

-- 5) Lista publica: inclui eventos em andamento.
create or replace function private.listar_eventos_publicos()
returns table(
  evento_id uuid, slug text, nome text, descricao text, imagem_url text,
  inicio_em timestamptz, local text, endereco text,
  status public.status_evento, vendas_status public.status_vendas,
  lote_id uuid, lote_nome text, preco numeric, situacao_venda text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.id, e.slug, e.nome, e.descricao, e.imagem_url, e.inicio_em, e.local, e.endereco,
    e.status, e.vendas_status,
    l.id, l.nome, l.preco,
    private.calcular_situacao_venda(e.id)
  from public.eventos e
  left join lateral (
    select lo.id, lo.nome, lo.preco
      from public.lotes lo
     where lo.evento_id = e.id and lo.status = 'ATIVO'
     limit 1
  ) l on true
  where e.publicacao_status = 'PUBLICADO'
    and e.status in ('AGENDADO', 'EM_ANDAMENTO')
  order by e.inicio_em asc;
$$;

-- 6) Admin pode marcar o encerramento das vendas depois do inicio.
create or replace function private.definir_encerramento_vendas_admin(
  p_evento_id uuid,
  p_vendas_encerram_em timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos%rowtype;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  select * into v_evento from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'Evento % nao encontrado', p_evento_id using errcode = '23503';
  end if;

  if v_evento.status in ('REALIZADO', 'CANCELADO') then
    raise exception 'Evento % nao pode ser editado (status=%)', p_evento_id, v_evento.status using errcode = '23514';
  end if;

  if v_evento.vendas_encerram_em is not distinct from p_vendas_encerram_em then
    return jsonb_build_object(
      'evento_id', p_evento_id,
      'vendas_encerram_em', p_vendas_encerram_em,
      'alterado', false
    );
  end if;

  update public.eventos
     set vendas_encerram_em = p_vendas_encerram_em,
         atualizado_em = now()
   where id = p_evento_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
  values (
    auth.uid(),
    'EVENTO_ENCERRAMENTO_VENDAS_ADMIN',
    'eventos',
    p_evento_id,
    jsonb_build_object('vendas_encerram_em', v_evento.vendas_encerram_em),
    jsonb_build_object('vendas_encerram_em', p_vendas_encerram_em)
  );

  return jsonb_build_object(
    'evento_id', p_evento_id,
    'vendas_encerram_em', p_vendas_encerram_em,
    'alterado', true
  );
end;
$$;
