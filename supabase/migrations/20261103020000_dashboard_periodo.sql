-- =============================================================================
-- GZ1 Ingresso - Dashboard: evento atual por padrao + filtro por periodo
-- Migration: dashboard_periodo
--
-- public.obter_dashboard_admin(p_evento_id uuid, p_periodo text):
--   * nada informado (padrao): mostra SO o "evento atual":
--       1. evento EM_ANDAMENTO; senao
--       2. proximo evento AGENDADO (futuro); senao
--       3. ultimo evento que ja aconteceu (nao cancelado).
--   * p_evento_id: somente esse evento (botao "Ver evento" / filtro).
--   * p_periodo = 'todos': todos os eventos.
--   * p_periodo = '7' | '15' | '30' | '90' ...: eventos cuja data de inicio
--     esta nos ultimos N dias (ate agora). Cancelados ficam de fora.
-- Retorna tambem:
--   * 'escopo'  : { modo, dias, quantidadeEventos } para o aviso da tela;
--   * 'eventos' : lista (id, nome, inicio_em, status) para o seletor.
-- Entradas por hora passam a somar todas as entradas dos eventos do escopo.
-- Chamadas antigas continuam funcionando (parametros com default), entao e
-- seguro aplicar antes de publicar o frontend.
-- Nao expoe tokens/secrets. Nao altera RLS.
-- =============================================================================

drop function if exists public.obter_dashboard_admin(uuid);
drop function if exists public.obter_dashboard_admin();

create or replace function public.obter_dashboard_admin(
  p_evento_id uuid default null,
  p_periodo text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_vendidos integer;
  v_utilizados integer;
  v_faturamento numeric;
  v_evento jsonb;
  v_evento_id uuid;
  v_ids uuid[];          -- null = todos os eventos
  v_modo text;
  v_dias integer;
  v_res jsonb;
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  -- Evento "atual" (usado no modo padrao e no card dos modos todos/periodo)
  select e.id into v_evento_id
    from public.eventos e
   where e.status = 'EM_ANDAMENTO'
   order by e.inicio_em desc
   limit 1;
  if v_evento_id is null then
    select e.id into v_evento_id
      from public.eventos e
     where e.status = 'AGENDADO' and e.inicio_em >= now()
     order by e.inicio_em asc
     limit 1;
  end if;
  if v_evento_id is null then
    select e.id into v_evento_id
      from public.eventos e
     where e.status <> 'CANCELADO' and e.inicio_em <= now()
     order by e.inicio_em desc
     limit 1;
  end if;

  if p_evento_id is not null then
    v_modo := 'evento';
    v_evento_id := p_evento_id;
    v_ids := array[p_evento_id];
  elsif p_periodo = 'todos' then
    v_modo := 'todos';
    v_ids := null;
  elsif p_periodo ~ '^[0-9]{1,3}$' and p_periodo::integer between 1 and 366 then
    v_modo := 'periodo';
    v_dias := p_periodo::integer;
    select coalesce(array_agg(e.id), '{}'::uuid[]) into v_ids
      from public.eventos e
     where e.status <> 'CANCELADO'
       and e.inicio_em >= now() - make_interval(days => v_dias)
       and e.inicio_em <= now();
  else
    v_modo := 'atual';
    v_ids := case when v_evento_id is null then '{}'::uuid[] else array[v_evento_id] end;
  end if;

  if v_evento_id is not null then
    select to_jsonb(t) into v_evento
      from (
        select e.id as evento_id, e.nome, e.slug, e.imagem_url, e.inicio_em, e.local, e.status
          from public.eventos e
         where e.id = v_evento_id
      ) t;
    if v_evento is null and v_modo = 'evento' then
      raise exception 'Evento % nao encontrado', p_evento_id using errcode = '23503';
    end if;
  end if;

  select count(*) filter (where i.status in ('VALIDO', 'UTILIZADO')),
         count(*) filter (where i.status = 'UTILIZADO')
    into v_vendidos, v_utilizados
    from public.ingressos i
   where v_ids is null or i.evento_id = any(v_ids);

  select coalesce(sum(pg.valor), 0) into v_faturamento
    from public.pagamentos pg
    join public.pedidos p on p.id = pg.pedido_id
   where pg.status = 'APROVADO'
     and (v_ids is null or p.evento_id = any(v_ids));

  select jsonb_build_object(
    'escopo', jsonb_build_object(
      'modo', v_modo,
      'dias', v_dias,
      'quantidadeEventos', case when v_ids is null
        then (select count(*) from public.eventos e where e.status <> 'CANCELADO')
        else coalesce(array_length(v_ids, 1), 0) end
    ),
    'metricas', jsonb_build_object(
      'vendidos', v_vendidos,
      'utilizados', v_utilizados,
      'naoEntraram', greatest(v_vendidos - v_utilizados, 0),
      'faturamento', v_faturamento,
      'ticketMedio', case when v_vendidos > 0 then round(v_faturamento / v_vendidos, 2) else 0 end
    ),
    'evento', v_evento,
    'eventos', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.inicio_em desc), '[]'::jsonb)
        from (
          select e.id, e.nome, e.inicio_em, e.status
            from public.eventos e
           order by e.inicio_em desc
           limit 200
        ) t
    ),
    'entradasPorHora', (
      select coalesce(jsonb_agg(jsonb_build_object('hora', l.hora, 'entradas', coalesce(c.q, 0)) order by l.ord), '[]'::jsonb)
        from (values ('18h',0,'18'),('19h',1,'19'),('20h',2,'20'),('21h',3,'21'),('22h',4,'22'),
                     ('23h',5,'23'),('00h',6,'00'),('01h',7,'01'),('02h',8,'02'),('03h',9,'03'),('04h',10,'04'))
             as l(hora, ord, hh)
        left join (
          select to_char(en.entrada_em at time zone 'America/Sao_Paulo', 'HH24') as hh, count(*) as q
            from public.entradas en
           where en.anulada_em is null
             and (v_ids is null or en.evento_id = any(v_ids))
           group by 1
        ) c on c.hh = l.hh
    ),
    'pagamentosPorStatus', jsonb_build_array(
      jsonb_build_object('key', 'paid', 'label', 'Pago',
        'value', (select count(*) from public.pagamentos pg join public.pedidos p on p.id = pg.pedido_id
          where pg.status = 'APROVADO' and (v_ids is null or p.evento_id = any(v_ids)))),
      jsonb_build_object('key', 'pending', 'label', 'Pendente',
        'value', (select count(*) from public.pagamentos pg join public.pedidos p on p.id = pg.pedido_id
          where pg.status = 'PENDENTE' and (v_ids is null or p.evento_id = any(v_ids)))),
      jsonb_build_object('key', 'canceled', 'label', 'Cancelado',
        'value', (select count(*) from public.pagamentos pg join public.pedidos p on p.id = pg.pedido_id
          where pg.status in ('REJEITADO','CANCELADO','EXPIRADO','REEMBOLSADO') and (v_ids is null or p.evento_id = any(v_ids))))
    ),
    'pedidosRecentes', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em desc), '[]'::jsonb)
        from (
          select p.id as pedido_id, p.codigo, p.comprador_nome as buyer,
                 p.quantidade as tickets, p.valor_total as total, p.status, p.criado_em,
                 (select count(*) from public.ingressos i where i.pedido_id = p.id and i.status = 'UTILIZADO') as entrance_used
            from public.pedidos p
           where v_ids is null or p.evento_id = any(v_ids)
           order by p.criado_em desc
           limit 5
        ) t
    ),
    'entradasRecentes', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.entrada_em desc), '[]'::jsonb)
        from (
          select en.id, i.participante_nome as name, i.codigo, en.entrada_em, en.metodo_validacao
            from public.entradas en
            join public.ingressos i on i.id = en.ingresso_id
           where en.anulada_em is null
             and (v_ids is null or en.evento_id = any(v_ids))
           order by en.entrada_em desc
           limit 5
        ) t
    )
  ) into v_res;

  return v_res;
end;
$$;

revoke execute on function public.obter_dashboard_admin(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.obter_dashboard_admin(uuid, text) to authenticated, service_role;

comment on function public.obter_dashboard_admin(uuid, text) is 'Dashboard administrativo. Padrao: evento atual (EM_ANDAMENTO, proximo AGENDADO ou ultimo realizado). p_evento_id: um evento. p_periodo: todos ou ultimos N dias (data do evento). Retorna escopo, metricas, evento, lista de eventos, entradas por hora, pagamentos, pedidos e entradas recentes. Sem tokens.';
