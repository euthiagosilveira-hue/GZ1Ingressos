-- =============================================================================
-- GZ1 Ingresso - Testes: status automatico dos eventos
-- Arquivo: supabase/tests/status_automatico_eventos.test.sql
-- Executar como owner. begin/rollback (nao persiste dados).
-- =============================================================================

begin;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_futuro uuid;
  v_agora uuid;
  v_antigo uuid;
  v_manual uuid;
  v_lote_antigo uuid;
  v_lote_data uuid;
  v_status text;
  v_res jsonb;
begin
  insert into auth.users (id) values (v_admin);
  insert into public.usuarios (id, nome, email, perfil, ativo) values
    (v_admin, 'Admin SA', 'adminsa_' || replace(v_admin::text,'-','') || '@test.local', 'ADMINISTRADOR', true);

  insert into public.eventos (nome, slug, inicio_em, local, endereco, capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status)
  values ('Futuro', 'sa-futuro-' || replace(gen_random_uuid()::text,'-',''), now() + interval '1 day', 'L', 'E', 100, 50, 'AGENDADO', 'PUBLICADO', 'ABERTAS')
  returning id into v_futuro;
  insert into public.eventos (nome, slug, inicio_em, local, endereco, capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status)
  values ('Agora', 'sa-agora-' || replace(gen_random_uuid()::text,'-',''), now() - interval '1 hour', 'L', 'E', 100, 50, 'AGENDADO', 'PUBLICADO', 'ABERTAS')
  returning id into v_agora;
  insert into public.eventos (nome, slug, inicio_em, local, endereco, capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status)
  values ('Antigo', 'sa-antigo-' || replace(gen_random_uuid()::text,'-',''), now() - interval '5 days', 'L', 'E', 100, 50, 'AGENDADO', 'PUBLICADO', 'ABERTAS')
  returning id into v_antigo;
  insert into public.eventos (nome, slug, inicio_em, local, endereco, capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status)
  values ('Manual', 'sa-manual-' || replace(gen_random_uuid()::text,'-',''), now() - interval '2 hours', 'L', 'E', 100, 50, 'AGENDADO', 'PUBLICADO', 'ABERTAS')
  returning id into v_manual;

  -- evento antigo: um lote ENCERRADO e um DATA_HORA vencido (nao pode virar)
  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, status)
  values (v_antigo, 'L1', 1, 10, 10, 'MANUAL', 'ATIVO') returning id into v_lote_antigo;
  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, ativacao_em, status)
  values (v_antigo, 'L2', 2, 10, 10, 'DATA_HORA', now() - interval '6 days', 'INATIVO') returning id into v_lote_data;

  -- A) manutencao
  perform private.processar_manutencao_eventos();

  select status into v_status from public.eventos where id = v_futuro;
  if v_status <> 'AGENDADO' then raise exception 'A1: futuro deveria seguir AGENDADO (%)', v_status; end if;

  select status into v_status from public.eventos where id = v_agora;
  if v_status <> 'EM_ANDAMENTO' then raise exception 'A2: iniciado ha 1h deveria estar EM_ANDAMENTO (%)', v_status; end if;

  select status into v_status from public.eventos where id = v_antigo;
  if v_status <> 'REALIZADO' then raise exception 'A3: iniciado ha 5 dias deveria estar REALIZADO (%)', v_status; end if;

  select status into v_status from public.lotes where id = v_lote_antigo;
  if v_status <> 'ENCERRADO' then raise exception 'A4: lote ativo do evento encerrado deveria fechar (%)', v_status; end if;
  select status into v_status from public.lotes where id = v_lote_data;
  if v_status <> 'INATIVO' then raise exception 'A5: lote por data nao deveria virar em evento encerrado (%)', v_status; end if;

  if not exists (select 1 from public.auditoria where entidade_id = v_antigo and acao = 'EVENTO_ENCERRADO_AUTOMATICO') then
    raise exception 'A6: auditoria do encerramento automatico ausente';
  end if;

  -- B) admin encerra: EM_ANDAMENTO e AGENDADO ja iniciado
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);

  v_res := public.encerrar_evento(v_agora);
  select status into v_status from public.eventos where id = v_agora;
  if v_status <> 'REALIZADO' then raise exception 'B1: deveria encerrar EM_ANDAMENTO (%)', v_status; end if;

  update public.eventos set status = 'AGENDADO' where id = v_manual and status <> 'AGENDADO';
  v_res := public.encerrar_evento(v_manual);
  select status into v_status from public.eventos where id = v_manual;
  if v_status <> 'REALIZADO' then raise exception 'B2: deveria encerrar AGENDADO ja iniciado (%)', v_status; end if;

  begin
    perform public.encerrar_evento(v_futuro);
    raise exception 'B3: nao deveria encerrar evento que nao comecou';
  exception when sqlstate '23514' then null;
  end;
end $$;

select 'status_automatico_eventos: todos os testes passaram' as resultado;

rollback;
