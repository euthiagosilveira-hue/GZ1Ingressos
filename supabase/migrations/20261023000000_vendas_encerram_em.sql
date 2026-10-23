-- =============================================================================
-- GZ1 Ingresso - Horario proprio de encerramento das vendas online
-- Migration: vendas_encerram_em
--
-- Ate aqui as vendas online (antecipadas) encerravam sempre no inicio do
-- evento. Agora cada evento pode ter um horario proprio de encerramento:
--
--   * public.eventos.vendas_encerram_em (nullable). Vazio = inicio do evento.
--   * private.limite_vendas_online(inicio_em, vendas_encerram_em): limite
--     efetivo, nunca depois do inicio do evento (least), para que uma mudanca
--     posterior do inicio nunca estenda a venda para dentro do evento.
--   * private.criar_reserva e private.calcular_situacao_venda passam a usar
--     o limite efetivo (checkout e catalogo publico ficam consistentes).
--   * public.definir_encerramento_vendas_admin(evento, horario|null)
--     (ADMINISTRADOR, auditado) define/limpa o horario.
--   * obter_evento_admin e listar_eventos_admin_filtrado expoem o campo.
--
-- Nao altera: venda manual do admin (segue liberada em AGENDADO/EM_ANDAMENTO),
-- pagamento de reservas ja criadas (respeita reserva_expira_em), automacoes.
-- Eventos existentes ficam com o campo vazio (comportamento atual preservado).
-- =============================================================================

alter table public.eventos
  add column if not exists vendas_encerram_em timestamptz null;

comment on column public.eventos.vendas_encerram_em is
  'Horario de encerramento das vendas online. Nulo = inicio do evento. Nunca vale depois de inicio_em.';

-- -----------------------------------------------------------------------------
-- Limite efetivo
-- -----------------------------------------------------------------------------
create or replace function private.limite_vendas_online(
  p_inicio_em timestamptz,
  p_vendas_encerram_em timestamptz
)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select least(coalesce(p_vendas_encerram_em, p_inicio_em), p_inicio_em);
$$;

revoke all on function private.limite_vendas_online(timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function private.limite_vendas_online(timestamptz, timestamptz)
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Reserva (checkout publico)
-- -----------------------------------------------------------------------------
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

  if v_evento.status <> 'AGENDADO' then
    raise exception 'Evento % nao esta AGENDADO (status=%)', p_evento_id, v_evento.status
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

  if now() >= v_evento.inicio_em then
    raise exception 'Evento % ja iniciado', p_evento_id using errcode = '23514';
  end if;

  if now() >= private.limite_vendas_online(v_evento.inicio_em, v_evento.vendas_encerram_em) then
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

-- ACL: reaplicar explicitamente (nao depender de default privileges)
revoke execute on function private.criar_reserva(uuid, text, text, text, text[])
  from public, anon, authenticated, service_role;
grant execute on function private.criar_reserva(uuid, text, text, text, text[])
  to anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Situacao de venda (catalogo publico)
-- -----------------------------------------------------------------------------
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
  if v_e.status = 'EM_ANDAMENTO' then
    return 'EVENTO_EM_ANDAMENTO';
  end if;
  if v_e.vendas_status <> 'ABERTAS' then
    return 'VENDAS_ENCERRADAS';
  end if;
  if now() >= private.limite_vendas_online(v_e.inicio_em, v_e.vendas_encerram_em) then
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

revoke all on function private.calcular_situacao_venda(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Leituras administrativas
-- -----------------------------------------------------------------------------
create or replace function private.obter_evento_admin(p_evento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_evento jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  select jsonb_build_object(
           'evento_id', e.id,
           'nome', e.nome,
           'slug', e.slug,
           'descricao', e.descricao,
           'imagem_url', e.imagem_url,
           'inicio_em', e.inicio_em,
           'vendas_encerram_em', e.vendas_encerram_em,
           'encerrado_em', e.encerrado_em,
           'local', e.local,
           'endereco', e.endereco,
           'capacidade_total', e.capacidade_total,
           'estoque_antecipado', e.estoque_antecipado,
           'status', e.status,
           'vendas_status', e.vendas_status,
           'publicacao_status', e.publicacao_status,
           'publicado_em', e.publicado_em
         )
    into v_evento
    from public.eventos e
   where e.id = p_evento_id;

  if v_evento is null then
    raise exception 'Evento % nao encontrado', p_evento_id using errcode = '23503';
  end if;

  return v_evento;
end;
$$;

create or replace function private.listar_eventos_admin_filtrado(
  p_busca text default null,
  p_status public.status_evento default null,
  p_publicacao public.status_publicacao default null,
  p_vendas public.status_vendas default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_itens jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  select coalesce(
           jsonb_agg(
             jsonb_build_object(
               'evento_id', e.id,
               'nome', e.nome,
               'slug', e.slug,
               'inicio_em', e.inicio_em,
               'vendas_encerram_em', e.vendas_encerram_em,
               'local', e.local,
               'status', e.status,
               'vendas_status', e.vendas_status,
               'publicacao_status', e.publicacao_status,
               'capacidade_total', e.capacidade_total,
               'estoque_antecipado', e.estoque_antecipado,
               'publicado_em', e.publicado_em,
               'imagem_url', e.imagem_url,
               'lote_ativo_id', la.id,
               'lote_ativo_nome', la.nome,
               'lote_ativo_ordem', la.ordem,
               'lote_ativo_preco', la.preco,
               'lote_ativo_quantidade', la.quantidade,
               'lote_ativo_vendidos', (
                 select count(*) from public.ingressos i
                  where i.lote_id = la.id and i.status in ('VALIDO', 'UTILIZADO')
               ),
               'lote_ativo_disponiveis', private.calcular_disponibilidade_lote(la.id),
               'lotes_count', (select count(*) from public.lotes l where l.evento_id = e.id),
               'pedidos_count', (select count(*) from public.pedidos p where p.evento_id = e.id),
               'ingressos_count', (select count(*) from public.ingressos i where i.evento_id = e.id)
             )
             order by
               case e.status when 'EM_ANDAMENTO' then 0 when 'AGENDADO' then 1 else 2 end,
               case when e.status in ('REALIZADO', 'CANCELADO') then e.inicio_em end desc nulls last,
               e.inicio_em asc
           ),
           '[]'::jsonb
         )
    into v_itens
    from public.eventos e
    left join lateral (
      select l.id, l.nome, l.ordem, l.preco, l.quantidade
        from public.lotes l
       where l.evento_id = e.id and l.status = 'ATIVO'
       order by l.ordem asc
       limit 1
    ) la on true
   where (
       p_busca is null or btrim(p_busca) = ''
       or e.nome ilike '%' || p_busca || '%'
       or e.slug ilike '%' || p_busca || '%'
       or e.local ilike '%' || p_busca || '%'
     )
     and (p_status is null or e.status = p_status)
     and (p_publicacao is null or e.publicacao_status = p_publicacao)
     and (p_vendas is null or e.vendas_status = p_vendas);

  return v_itens;
end;
$$;

-- -----------------------------------------------------------------------------
-- Definir horario (ADMINISTRADOR)
-- -----------------------------------------------------------------------------
create or replace function private.definir_encerramento_vendas_admin(
  p_evento_id uuid,
  p_vendas_encerram_em timestamptz default null
)
returns jsonb
language plpgsql
volatile
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

  if p_vendas_encerram_em is not null and p_vendas_encerram_em > v_evento.inicio_em then
    raise exception 'O encerramento das vendas nao pode ser depois do inicio do evento' using errcode = '23514';
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

create or replace function public.definir_encerramento_vendas_admin(
  p_evento_id uuid,
  p_vendas_encerram_em timestamptz default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.definir_encerramento_vendas_admin(p_evento_id, p_vendas_encerram_em);
$$;

revoke all on function private.definir_encerramento_vendas_admin(uuid, timestamptz) from public;
grant execute on function private.definir_encerramento_vendas_admin(uuid, timestamptz) to authenticated, service_role;

revoke execute on function public.definir_encerramento_vendas_admin(uuid, timestamptz)
  from public, anon, authenticated, service_role;
grant execute on function public.definir_encerramento_vendas_admin(uuid, timestamptz)
  to authenticated, service_role;

comment on function public.definir_encerramento_vendas_admin(uuid, timestamptz) is
  'Define (ou limpa, com null) o horario de encerramento das vendas online (ADMINISTRADOR).';
