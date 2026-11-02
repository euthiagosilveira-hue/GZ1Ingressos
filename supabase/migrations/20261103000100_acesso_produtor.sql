-- =============================================================================
-- GZ1 Ingresso - Acesso do produtor aos eventos em sociedade (etapa 2)
-- Migration: acesso_produtor
--
-- Requer 20261103000000_perfil_produtor.sql aplicado antes.
--
-- O produtor (public.usuarios.perfil = PRODUTOR, ligado a public.produtores
-- por produtores.usuario_id) enxerga SOMENTE os eventos em que esta em
-- public.eventos_sociedade. Tudo e somente leitura, exceto a lista VIP
-- (pode adicionar convidados e remover os que ele mesmo adicionou).
--
--   private.produtor_atual_id()            produtor do usuario logado (ou null)
--   private.produtor_acessa_evento(evento) evento e dele?
--   private.totais_sociedade(evento, %)    divisao dos pagamentos aprovados
--   public.listar_eventos_produtor()
--   public.obter_evento_produtor(evento)   resumo + divisao
--   public.listar_vendas_evento_produtor(evento)  pedidos pagos, SO nome do comprador
--   public.listar_vip_produtor(evento)
--   public.adicionar_vip_produtor(evento, nome, observacao)
--   public.remover_vip_produtor(vip)
--
-- Telefone/e-mail dos compradores e dos convidados VIP NAO sao devolvidos.
-- Nenhuma funcao existente e alterada; nenhuma tabela ganha acesso direto.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Auxiliares
-- -----------------------------------------------------------------------------
create or replace function private.produtor_atual_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
    from public.produtores p
    join public.usuarios u on u.id = p.usuario_id
   where u.id = auth.uid()
     and u.ativo = true
     and u.perfil::text = 'PRODUTOR'
     and p.ativo = true
   limit 1;
$$;

revoke all on function private.produtor_atual_id() from public, anon;
grant execute on function private.produtor_atual_id() to authenticated, service_role;

create or replace function private.produtor_acessa_evento(p_evento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.eventos_sociedade s
     where s.evento_id = p_evento_id
       and s.produtor_id = private.produtor_atual_id()
  );
$$;

revoke all on function private.produtor_acessa_evento(uuid) from public, anon;
grant execute on function private.produtor_acessa_evento(uuid) to authenticated, service_role;

create or replace function private.exigir_produtor_do_evento(p_evento_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.produtor_atual_id() is null then
    raise exception 'Permissao negada: apenas PRODUTOR' using errcode = '42501';
  end if;
  -- Mesmo erro para "nao existe" e "nao e seu": nao revela outros eventos.
  if not private.produtor_acessa_evento(p_evento_id) then
    raise exception 'Evento nao encontrado' using errcode = '23503';
  end if;
end;
$$;

revoke all on function private.exigir_produtor_do_evento(uuid) from public, anon;
grant execute on function private.exigir_produtor_do_evento(uuid) to authenticated, service_role;

create or replace function private.totais_sociedade(p_evento_id uuid, p_percentual_galeria numeric)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_online numeric(12, 2);
  v_portaria numeric(12, 2);
  v_pedidos integer;
  v_g_online numeric(12, 2);
  v_g_portaria numeric(12, 2);
begin
  select coalesce(sum(pg.valor) filter (where pg.provedor = 'MERCADO_PAGO'), 0),
         coalesce(sum(pg.valor) filter (where pg.provedor <> 'MERCADO_PAGO'), 0),
         count(*)
    into v_online, v_portaria, v_pedidos
    from public.pagamentos pg
    join public.pedidos p on p.id = pg.pedido_id
   where p.evento_id = p_evento_id
     and pg.status = 'APROVADO';

  v_g_online := round(v_online * p_percentual_galeria / 100, 2);
  v_g_portaria := round(v_portaria * p_percentual_galeria / 100, 2);

  return jsonb_build_object(
    'pedidos_pagos', v_pedidos,
    'online', v_online,
    'portaria', v_portaria,
    'total', v_online + v_portaria,
    'galeria', v_g_online + v_g_portaria,
    'produtor', (v_online + v_portaria) - (v_g_online + v_g_portaria),
    'galeria_online', v_g_online,
    'produtor_online', v_online - v_g_online,
    'galeria_portaria', v_g_portaria,
    'produtor_portaria', v_portaria - v_g_portaria
  );
end;
$$;

revoke all on function private.totais_sociedade(uuid, numeric) from public, anon, authenticated;
grant execute on function private.totais_sociedade(uuid, numeric) to service_role;

-- -----------------------------------------------------------------------------
-- Meus eventos
-- -----------------------------------------------------------------------------
create or replace function public.listar_eventos_produtor()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_produtor uuid := private.produtor_atual_id();
begin
  if v_produtor is null then
    raise exception 'Permissao negada: apenas PRODUTOR' using errcode = '42501';
  end if;

  return (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'evento_id', e.id,
                 'nome', e.nome,
                 'slug', e.slug,
                 'imagem_url', e.imagem_url,
                 'inicio_em', e.inicio_em,
                 'local', e.local,
                 'status', e.status,
                 'vendas_status', e.vendas_status,
                 'publicacao_status', e.publicacao_status,
                 'percentual_galeria', s.percentual_galeria,
                 'percentual_produtor', 100 - s.percentual_galeria,
                 'vendidos', (
                   select count(*) from public.ingressos i
                    where i.evento_id = e.id and i.status in ('VALIDO', 'UTILIZADO')
                 )
               )
               order by
                 case e.status when 'EM_ANDAMENTO' then 0 when 'AGENDADO' then 1 else 2 end,
                 case when e.status in ('REALIZADO', 'CANCELADO') then e.inicio_em end desc nulls last,
                 e.inicio_em asc
             ),
             '[]'::jsonb
           )
      from public.eventos_sociedade s
      join public.eventos e on e.id = s.evento_id
     where s.produtor_id = v_produtor
  );
end;
$$;

revoke execute on function public.listar_eventos_produtor() from public, anon, authenticated, service_role;
grant execute on function public.listar_eventos_produtor() to authenticated, service_role;

comment on function public.listar_eventos_produtor() is
  'Eventos em sociedade do produtor logado (PRODUTOR). Somente os eventos dele.';

-- -----------------------------------------------------------------------------
-- Resumo de um evento
-- -----------------------------------------------------------------------------
create or replace function public.obter_evento_produtor(p_evento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  perform private.exigir_produtor_do_evento(p_evento_id);

  select jsonb_build_object(
           'evento_id', e.id,
           'nome', e.nome,
           'slug', e.slug,
           'imagem_url', e.imagem_url,
           'inicio_em', e.inicio_em,
           'local', e.local,
           'status', e.status,
           'vendas_status', e.vendas_status,
           'publicacao_status', e.publicacao_status,
           'capacidade_total', e.capacidade_total,
           'percentual_galeria', s.percentual_galeria,
           'percentual_produtor', 100 - s.percentual_galeria,
           'produtor_nome', p.nome,
           'vendidos', (select count(*) from public.ingressos i
                         where i.evento_id = e.id and i.status in ('VALIDO', 'UTILIZADO')),
           'utilizados', (select count(*) from public.ingressos i
                           where i.evento_id = e.id and i.status = 'UTILIZADO'),
           'vip_total', (select count(*) from public.lista_vip lv
                          where lv.evento_id = e.id and lv.ativo),
           'vip_entraram', (select count(distinct ev.lista_vip_id) from public.entradas_vip ev
                             where ev.evento_id = e.id and ev.anulada_em is null),
           'lote_ativo', (
             select jsonb_build_object('nome', l.nome, 'preco', l.preco)
               from public.lotes l
              where l.evento_id = e.id and l.status = 'ATIVO'
              order by l.ordem asc
              limit 1
           ),
           'totais', private.totais_sociedade(e.id, s.percentual_galeria)
         )
    into v_res
    from public.eventos e
    join public.eventos_sociedade s on s.evento_id = e.id
    join public.produtores p on p.id = s.produtor_id
   where e.id = p_evento_id;

  return v_res;
end;
$$;

revoke execute on function public.obter_evento_produtor(uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_evento_produtor(uuid) to authenticated, service_role;

comment on function public.obter_evento_produtor(uuid) is
  'Resumo de um evento do produtor logado: vendas, entradas, VIP e divisao galeria/produtor (PRODUTOR).';

-- -----------------------------------------------------------------------------
-- Vendas (pedidos pagos) - so o nome do comprador
-- -----------------------------------------------------------------------------
create or replace function public.listar_vendas_evento_produtor(p_evento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_produtor_do_evento(p_evento_id);

  return (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'codigo', p.codigo,
                 'comprador_nome', p.comprador_nome,
                 'quantidade', p.quantidade,
                 'valor_total', p.valor_total,
                 'forma', case when pg.provedor = 'MERCADO_PAGO' then 'ONLINE' else 'PORTARIA' end,
                 'pago_em', coalesce(p.pago_em, pg.confirmado_em)
               )
               order by coalesce(p.pago_em, pg.confirmado_em) desc nulls last
             ),
             '[]'::jsonb
           )
      from public.pedidos p
      join public.pagamentos pg on pg.pedido_id = p.id
     where p.evento_id = p_evento_id
       and pg.status = 'APROVADO'
  );
end;
$$;

revoke execute on function public.listar_vendas_evento_produtor(uuid) from public, anon, authenticated, service_role;
grant execute on function public.listar_vendas_evento_produtor(uuid) to authenticated, service_role;

comment on function public.listar_vendas_evento_produtor(uuid) is
  'Pedidos pagos de um evento do produtor logado, sem telefone/e-mail (PRODUTOR).';

-- -----------------------------------------------------------------------------
-- Lista VIP do produtor
-- -----------------------------------------------------------------------------
create or replace function public.listar_vip_produtor(p_evento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_produtor_do_evento(p_evento_id);

  return (
    select coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'vip_id', lv.id,
                 'nome', lv.nome,
                 'observacao', lv.observacao,
                 'entrou', (ev.id is not null),
                 'entrada_em', ev.entrada_em,
                 'adicionado_por_mim', (lv.criado_por_usuario_id = auth.uid())
               )
               order by lv.nome asc, lv.criado_em asc
             ),
             '[]'::jsonb
           )
      from public.lista_vip lv
      left join lateral (
        select e.id, e.entrada_em
          from public.entradas_vip e
         where e.lista_vip_id = lv.id
           and e.anulada_em is null
         order by e.entrada_em desc
         limit 1
      ) ev on true
     where lv.evento_id = p_evento_id
       and lv.ativo = true
  );
end;
$$;

revoke execute on function public.listar_vip_produtor(uuid) from public, anon, authenticated, service_role;
grant execute on function public.listar_vip_produtor(uuid) to authenticated, service_role;

create or replace function public.adicionar_vip_produtor(
  p_evento_id uuid,
  p_nome text,
  p_observacao text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_status public.status_evento;
  v_id uuid;
  v_nome text := btrim(coalesce(p_nome, ''));
begin
  perform private.exigir_produtor_do_evento(p_evento_id);

  if v_nome = '' then
    raise exception 'Informe o nome do convidado' using errcode = '23514';
  end if;
  if length(v_nome) > 120 then
    raise exception 'Nome do convidado muito longo' using errcode = '23514';
  end if;

  select e.status into v_status from public.eventos e where e.id = p_evento_id for update;
  if v_status in ('REALIZADO', 'CANCELADO') then
    raise exception 'Evento encerrado: a lista VIP nao pode mais ser alterada' using errcode = '23514';
  end if;

  insert into public.lista_vip (evento_id, nome, observacao, criado_por_usuario_id)
  values (
    p_evento_id,
    v_nome,
    nullif(left(btrim(coalesce(p_observacao, '')), 200), ''),
    auth.uid()
  )
  returning id into v_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_novos)
  values (
    auth.uid(), 'VIP_ADICIONADO_PRODUTOR', 'lista_vip', v_id,
    jsonb_build_object('evento_id', p_evento_id, 'nome', v_nome)
  );

  return jsonb_build_object('vip_id', v_id, 'evento_id', p_evento_id, 'nome', v_nome);
end;
$$;

revoke execute on function public.adicionar_vip_produtor(uuid, text, text) from public, anon, authenticated, service_role;
grant execute on function public.adicionar_vip_produtor(uuid, text, text) to authenticated, service_role;

create or replace function public.remover_vip_produtor(p_vip_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_vip public.lista_vip%rowtype;
  v_status public.status_evento;
begin
  select * into v_vip from public.lista_vip lv where lv.id = p_vip_id and lv.ativo for update;
  if not found then
    raise exception 'Convidado nao encontrado' using errcode = '23503';
  end if;

  perform private.exigir_produtor_do_evento(v_vip.evento_id);

  if v_vip.criado_por_usuario_id is distinct from auth.uid() then
    raise exception 'Permissao negada: so e possivel remover convidados adicionados por voce' using errcode = '42501';
  end if;

  select e.status into v_status from public.eventos e where e.id = v_vip.evento_id;
  if v_status in ('REALIZADO', 'CANCELADO') then
    raise exception 'Evento encerrado: a lista VIP nao pode mais ser alterada' using errcode = '23514';
  end if;

  if exists (select 1 from public.entradas_vip ev where ev.lista_vip_id = p_vip_id and ev.anulada_em is null) then
    raise exception 'Convidado ja entrou e nao pode ser removido' using errcode = '23514';
  end if;

  update public.lista_vip set ativo = false, atualizado_em = now() where id = p_vip_id;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores)
  values (
    auth.uid(), 'VIP_REMOVIDO_PRODUTOR', 'lista_vip', p_vip_id,
    jsonb_build_object('evento_id', v_vip.evento_id, 'nome', v_vip.nome)
  );

  return jsonb_build_object('vip_id', p_vip_id, 'removido', true);
end;
$$;

revoke execute on function public.remover_vip_produtor(uuid) from public, anon, authenticated, service_role;
grant execute on function public.remover_vip_produtor(uuid) to authenticated, service_role;

comment on function public.listar_vip_produtor(uuid) is 'Lista VIP de um evento do produtor logado, sem telefone (PRODUTOR).';
comment on function public.adicionar_vip_produtor(uuid, text, text) is 'Produtor adiciona convidado VIP no seu evento (auditado).';
comment on function public.remover_vip_produtor(uuid) is 'Produtor remove convidado VIP que ele mesmo adicionou e que ainda nao entrou (auditado).';
