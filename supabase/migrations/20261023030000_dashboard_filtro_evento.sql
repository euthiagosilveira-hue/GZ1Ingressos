-- =============================================================================
-- GZ1 Ingresso - Dashboard: filtro por evento ("Ver evento")
-- Migration: dashboard_filtro_evento
--
-- public.obter_dashboard_admin passa a aceitar p_evento_id (opcional):
--   * null (padrao): comportamento atual (todos os eventos; card mostra o
--     evento EM_ANDAMENTO ou o proximo AGENDADO);
--   * informado: metricas, entradas por hora, pagamentos, pedidos e entradas
--     recentes consideram SOMENTE esse evento, e o card mostra esse evento
--     (qualquer status). Entradas por hora usam a noite do evento.
-- Chamadas sem argumento continuam funcionando (default null), entao e seguro
-- aplicar antes de publicar o frontend.
-- Nao expoe tokens/secrets. Nao altera RLS.
-- =============================================================================

drop function if exists public.obter_dashboard_admin();

create or replace function public.obter_dashboard_admin(p_evento_id uuid default null)
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
  v_res jsonb;
  v_ref timestamptz := now();
begin
  if not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  select count(*) filter (where i.status in ('VALIDO', 'UTILIZADO')),
         count(*) filter (where i.status = 'UTILIZADO')
    into v_vendidos, v_utilizados
    from public.ingressos i
   where p_evento_id is null or i.evento_id = p_evento_id;

  select coalesce(sum(pg.valor), 0) into v_faturamento
    from public.pagamentos pg
    join public.pedidos p on p.id = pg.pedido_id
   where pg.status = 'APROVADO'
     and (p_evento_id is null or p.evento_id = p_evento_id);

  if p_evento_id is not null then
    -- Filtro: o card mostra o evento escolhido (qualquer status)
    select to_jsonb(t) into v_evento
      from (
        select e.id as evento_id, e.nome, e.slug, e.imagem_url, e.inicio_em, e.local, e.status
          from public.eventos e
         where e.id = p_evento_id
      ) t;
    if v_evento is null then
      raise exception 'Evento % nao encontrado', p_evento_id using errcode = '23503';
    end if;
    -- Entradas por hora: usar a noite do evento, nao a de hoje
    v_ref := (v_evento->>'inicio_em')::timestamptz;
  else
    -- Prioridade 1: evento EM_ANDAMENTO (mais recente por inicio_em)
    select to_jsonb(t) into v_evento
      from (
        select e.id as evento_id, e.nome, e.slug, e.imagem_url, e.inicio_em, e.local, e.status
          from public.eventos e
         where e.status = 'EM_ANDAMENTO'
         order by e.inicio_em desc
         limit 1
      ) t;

    -- Prioridade 2: proximo evento AGENDADO futuro (qualquer data, nao so hoje)
    if v_evento is null then
      select to_jsonb(t) into v_evento
        from (
          select e.id as evento_id, e.nome, e.slug, e.imagem_url, e.inicio_em, e.local, e.status
            from public.eventos e
           where e.status = 'AGENDADO' and e.inicio_em >= now()
           order by e.inicio_em asc
           limit 1
        ) t;
    end if;
  end if;

  select jsonb_build_object(
    'metricas', jsonb_build_object(
      'vendidos', v_vendidos,
      'utilizados', v_utilizados,
      'naoEntraram', greatest(v_vendidos - v_utilizados, 0),
      'faturamento', v_faturamento,
      'ticketMedio', case when v_vendidos > 0 then round(v_faturamento / v_vendidos, 2) else 0 end
    ),
    'evento', v_evento,
    'entradasPorHora', (
      select coalesce(jsonb_agg(jsonb_build_object('hora', l.hora, 'entradas', coalesce(c.q, 0)) order by l.ord), '[]'::jsonb)
        from (values ('18h',0,'18'),('19h',1,'19'),('20h',2,'20'),('21h',3,'21'),('22h',4,'22'),
                     ('23h',5,'23'),('00h',6,'00'),('01h',7,'01'),('02h',8,'02'),('03h',9,'03'),('04h',10,'04'))
             as l(hora, ord, hh)
        left join (
          select to_char(en.entrada_em at time zone 'America/Sao_Paulo', 'HH24') as hh, count(*) as q
            from public.entradas en
           where en.anulada_em is null
             and (p_evento_id is null or en.evento_id = p_evento_id)
             and en.entrada_em >= (
               (date_trunc('day', v_ref at time zone 'America/Sao_Paulo')
                 - case when extract(hour from (v_ref at time zone 'America/Sao_Paulo')) < 6 then interval '1 day' else interval '0' end)
               + interval '18 hours'
             ) at time zone 'America/Sao_Paulo'
             and en.entrada_em < (
               (date_trunc('day', v_ref at time zone 'America/Sao_Paulo')
                 - case when extract(hour from (v_ref at time zone 'America/Sao_Paulo')) < 6 then interval '1 day' else interval '0' end)
               + interval '29 hours'
             ) at time zone 'America/Sao_Paulo'
           group by 1
        ) c on c.hh = l.hh
    ),
    'pagamentosPorStatus', jsonb_build_array(
      jsonb_build_object('key', 'paid', 'label', 'Pago',
        'value', (select count(*) from public.pagamentos pg join public.pedidos p on p.id = pg.pedido_id
          where pg.status = 'APROVADO' and (p_evento_id is null or p.evento_id = p_evento_id))),
      jsonb_build_object('key', 'pending', 'label', 'Pendente',
        'value', (select count(*) from public.pagamentos pg join public.pedidos p on p.id = pg.pedido_id
          where pg.status = 'PENDENTE' and (p_evento_id is null or p.evento_id = p_evento_id))),
      jsonb_build_object('key', 'canceled', 'label', 'Cancelado',
        'value', (select count(*) from public.pagamentos pg join public.pedidos p on p.id = pg.pedido_id
          where pg.status in ('REJEITADO','CANCELADO','EXPIRADO','REEMBOLSADO') and (p_evento_id is null or p.evento_id = p_evento_id)))
    ),
    'pedidosRecentes', (
      select coalesce(jsonb_agg(to_jsonb(t) order by t.criado_em desc), '[]'::jsonb)
        from (
          select p.id as pedido_id, p.codigo, p.comprador_nome as buyer,
                 p.quantidade as tickets, p.valor_total as total, p.status, p.criado_em,
                 (select count(*) from public.ingressos i where i.pedido_id = p.id and i.status = 'UTILIZADO') as entrance_used
            from public.pedidos p
           where p_evento_id is null or p.evento_id = p_evento_id
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
             and (p_evento_id is null or en.evento_id = p_evento_id)
           order by en.entrada_em desc
           limit 5
        ) t
    )
  ) into v_res;

  return v_res;
end;
$$;

revoke execute on function public.obter_dashboard_admin(uuid) from public, anon, authenticated, service_role;
grant execute on function public.obter_dashboard_admin(uuid) to authenticated, service_role;

comment on function public.obter_dashboard_admin(uuid) is 'Dashboard administrativo (opcionalmente filtrado por p_evento_id): metricas, evento relevante (EM_ANDAMENTO ou proximo AGENDADO, com evento_id e imagem_url), entradas por hora, pagamentos, pedidos e entradas recentes. Sem tokens.';
