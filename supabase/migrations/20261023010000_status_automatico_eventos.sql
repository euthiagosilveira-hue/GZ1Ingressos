-- =============================================================================
-- GZ1 Ingresso - Status automatico dos eventos
-- Migration: status_automatico_eventos
--
-- A rotina private.processar_manutencao_eventos() existia, mas nunca foi
-- agendada: eventos passados ficavam AGENDADO para sempre. Esta migration:
--
--   * private.processar_encerramento_eventos(): encerra (REALIZADO) eventos
--     EM_ANDAMENTO 12 horas depois do inicio, sem depender de usuario.
--   * private.processar_manutencao_eventos(): passa a iniciar/encerrar os
--     eventos ANTES das viradas de lote (evento ja encerrado nao vira lote).
--   * private.encerrar_evento(): o admin tambem pode encerrar um evento
--     AGENDADO cujo inicio ja passou (inicia e encerra na mesma chamada).
--   * pg_cron: agenda a manutencao a cada minuto (quando a extensao existe).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Encerramento automatico (12h apos o inicio)
-- -----------------------------------------------------------------------------
create or replace function private.processar_encerramento_eventos(p_evento_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
  v_lote_id uuid;
  v_ts timestamptz;
  v_encerrados jsonb := '[]'::jsonb;
begin
  for v_rec in
    select e.id from public.eventos e
     where e.status = 'EM_ANDAMENTO' and e.inicio_em <= now() - interval '12 hours'
       and (p_evento_id is null or e.id = p_evento_id)
     order by e.id for update
  loop
    v_ts := now();
    update public.eventos
       set status = 'REALIZADO', encerrado_em = v_ts, vendas_status = 'ENCERRADAS'
     where id = v_rec.id;

    v_lote_id := null;
    select l.id into v_lote_id from public.lotes l
     where l.evento_id = v_rec.id and l.status = 'ATIVO' for update;
    if v_lote_id is not null then
      update public.lotes set status = 'ENCERRADO', encerrado_em = v_ts where id = v_lote_id;
    end if;

    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (null, 'EVENTO_ENCERRADO_AUTOMATICO', 'eventos', v_rec.id,
      jsonb_build_object('status_anterior', 'EM_ANDAMENTO'),
      jsonb_build_object('status', 'REALIZADO', 'encerrado_em', v_ts, 'vendas_status', 'ENCERRADAS', 'lote_encerrado_id', v_lote_id));
    v_encerrados := v_encerrados || jsonb_build_object('evento_id', v_rec.id);
  end loop;

  return jsonb_build_object('encerrados', jsonb_array_length(v_encerrados), 'eventos', v_encerrados);
end;
$$;

revoke all on function private.processar_encerramento_eventos(uuid) from public, anon, authenticated;
grant execute on function private.processar_encerramento_eventos(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Manutencao: iniciar/encerrar eventos antes das viradas de lote
-- -----------------------------------------------------------------------------
create or replace function private.processar_manutencao_eventos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservas jsonb;
  v_inicio jsonb;
  v_encerramento jsonb;
  v_data jsonb;
  v_esgotamento jsonb := '[]'::jsonb;
  v_rec record;
begin
  v_reservas := private.processar_reservas_expiradas(null);
  v_inicio := private.processar_inicio_eventos(null);
  v_encerramento := private.processar_encerramento_eventos(null);
  v_data := private.processar_viradas_lote_por_data(null);

  for v_rec in
    select l.evento_id from public.lotes l
      join public.eventos e on e.id = l.evento_id
     where l.status = 'ATIVO' and e.status not in ('CANCELADO', 'REALIZADO')
     group by l.evento_id
  loop
    v_esgotamento := v_esgotamento || private.processar_virada_lote_esgotamento(v_rec.evento_id);
  end loop;

  return jsonb_build_object(
    'reservas_expiradas', v_reservas,
    'eventos_iniciados', v_inicio,
    'eventos_encerrados', v_encerramento,
    'lotes_por_data', v_data,
    'lotes_por_esgotamento', v_esgotamento
  );
end;
$$;

revoke all on function private.processar_manutencao_eventos() from public, anon, authenticated;
grant execute on function private.processar_manutencao_eventos() to service_role;

-- -----------------------------------------------------------------------------
-- Encerrar evento (ADMINISTRADOR): aceita AGENDADO cujo inicio ja passou
-- -----------------------------------------------------------------------------
create or replace function private.encerrar_evento(p_evento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evento public.eventos%rowtype;
  v_lote public.lotes%rowtype;
  v_usuario_id uuid;
  v_ts timestamptz := now();
begin
  v_usuario_id := auth.uid();
  if v_usuario_id is null or not private.usuario_e_admin() then
    raise exception 'Permissao negada: apenas ADMINISTRADOR' using errcode = '42501';
  end if;

  select * into v_evento from public.eventos e where e.id = p_evento_id for update;
  if not found then
    raise exception 'Evento % nao encontrado', p_evento_id using errcode = '23503';
  end if;

  if v_evento.status = 'CANCELADO' then
    raise exception 'Evento % esta CANCELADO', p_evento_id using errcode = '23514';
  end if;

  if v_evento.status = 'REALIZADO' then
    raise exception 'Evento % ja esta REALIZADO', p_evento_id using errcode = '23514';
  end if;

  if v_evento.status = 'AGENDADO' and now() >= v_evento.inicio_em then
    perform private.processar_inicio_eventos(p_evento_id);
    select * into v_evento from public.eventos e where e.id = p_evento_id for update;
  end if;

  if v_evento.status <> 'EM_ANDAMENTO' then
    raise exception 'Somente evento EM_ANDAMENTO pode ser encerrado (status=%)', v_evento.status using errcode = '23514';
  end if;

  update public.eventos set status = 'REALIZADO', encerrado_em = v_ts, vendas_status = 'ENCERRADAS' where id = p_evento_id;

  select * into v_lote from public.lotes l where l.evento_id = p_evento_id and l.status = 'ATIVO' for update;
  if v_lote.id is not null then
    update public.lotes set status = 'ENCERRADO', encerrado_em = v_ts where id = v_lote.id;
  end if;

  insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
  values (v_usuario_id, 'EVENTO_ENCERRADO', 'eventos', p_evento_id,
    jsonb_build_object('status_anterior', v_evento.status),
    jsonb_build_object('status', 'REALIZADO', 'encerrado_em', v_ts, 'vendas_status', 'ENCERRADAS', 'lote_encerrado_id', v_lote.id));

  return jsonb_build_object('resultado', 'ENCERRADO', 'evento_id', p_evento_id, 'status', 'REALIZADO', 'encerrado_em', v_ts, 'lote_encerrado_id', v_lote.id);
end;
$$;

revoke all on function private.encerrar_evento(uuid) from public;
grant execute on function private.encerrar_evento(uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Agendamento (pg_cron, a cada minuto). Ignorado onde a extensao nao existe.
-- -----------------------------------------------------------------------------
do $do$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron indisponivel: manutencao de eventos nao agendada';
    return;
  end if;

  create extension if not exists pg_cron with schema pg_catalog;

  if exists (select 1 from cron.job where jobname = 'gz1-manutencao-eventos') then
    perform cron.unschedule('gz1-manutencao-eventos');
  end if;

  perform cron.schedule(
    'gz1-manutencao-eventos',
    '* * * * *',
    'select private.processar_manutencao_eventos()'
  );
end
$do$;
