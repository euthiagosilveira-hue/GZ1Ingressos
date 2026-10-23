-- =============================================================================
-- GZ1 Ingresso - Testes: horario proprio de encerramento das vendas online
-- Arquivo: supabase/tests/vendas_encerram_em.test.sql
-- Executar como owner. begin/rollback (nao persiste dados).
-- =============================================================================

begin;

-- A) ACL ----------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon',
       'public.definir_encerramento_vendas_admin(uuid,timestamptz)'::regprocedure, 'EXECUTE') then
    raise exception 'A: anon nao pode definir_encerramento_vendas_admin';
  end if;
end $$;

-- B) limite efetivo -----------------------------------------------------------
do $$
declare
  v_inicio timestamptz := '2026-11-01 21:00:00+00';
begin
  if private.limite_vendas_online(v_inicio, null) <> v_inicio then
    raise exception 'B1: sem horario proprio deveria valer o inicio';
  end if;
  if private.limite_vendas_online(v_inicio, v_inicio - interval '3 hours') <> v_inicio - interval '3 hours' then
    raise exception 'B2: horario proprio deveria ser respeitado';
  end if;
  if private.limite_vendas_online(v_inicio, v_inicio + interval '1 hour') <> v_inicio then
    raise exception 'B3: nunca deveria passar do inicio';
  end if;
end $$;

-- C) reserva, catalogo e RPC admin --------------------------------------------
do $$
declare
  v_admin uuid := gen_random_uuid();
  v_portaria uuid := gen_random_uuid();
  v_evento uuid;
  v_slug text := 'teste-encerra-' || replace(gen_random_uuid()::text, '-', '');
  v_res jsonb;
  v_sit text;
  v_aud integer;
  v_det jsonb;
  v_lista jsonb;
begin
  insert into auth.users (id) values (v_admin), (v_portaria);
  insert into public.usuarios (id, nome, email, perfil, ativo) values
    (v_admin, 'Admin VE', 'adminve_' || replace(v_admin::text,'-','') || '@test.local', 'ADMINISTRADOR', true),
    (v_portaria, 'Port VE', 'portve_' || replace(v_portaria::text,'-','') || '@test.local', 'PORTARIA', true);

  insert into public.eventos (
    nome, slug, inicio_em, local, endereco,
    capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status
  ) values (
    'Teste Encerramento', v_slug, now() + interval '2 hours', 'Local T', 'End T',
    100, 50, 'AGENDADO', 'PUBLICADO', 'ABERTAS'
  ) returning id into v_evento;

  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, status)
  values (v_evento, 'Lote T', 1, 50, 40, 'MANUAL', 'ATIVO');

  -- C1) sem horario proprio: vende normalmente
  select situacao_venda into v_sit from public.obter_evento_publico(v_slug);
  if v_sit <> 'DISPONIVEL' then
    raise exception 'C1: deveria estar DISPONIVEL, veio %', v_sit;
  end if;
  v_res := public.criar_reserva(v_evento, 'Comprador', '34999999999', 'c@gz1.local', array['P1']);
  if v_res->>'pedido_id' is null then
    raise exception 'C1: reserva deveria ser criada';
  end if;

  -- C2) PORTARIA nao pode definir
  perform set_config('request.jwt.claims', json_build_object('sub', v_portaria::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_portaria::text, true);
  begin
    perform public.definir_encerramento_vendas_admin(v_evento, now() - interval '1 minute');
    raise exception 'C2: PORTARIA nao deveria definir';
  exception when sqlstate '42501' then null;
  end;

  -- C3) ADMIN nao pode definir depois do inicio
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  begin
    perform public.definir_encerramento_vendas_admin(v_evento, now() + interval '3 hours');
    raise exception 'C3: nao deveria aceitar horario depois do inicio';
  exception when sqlstate '23514' then null;
  end;

  -- C4) ADMIN encerra 1 minuto atras: catalogo e reserva bloqueiam
  v_res := public.definir_encerramento_vendas_admin(v_evento, now() - interval '1 minute');
  if (v_res->>'alterado')::boolean is not true then
    raise exception 'C4: deveria marcar alterado';
  end if;
  select count(*) into v_aud from public.auditoria
   where entidade_id = v_evento and acao = 'EVENTO_ENCERRAMENTO_VENDAS_ADMIN';
  if v_aud <> 1 then
    raise exception 'C4: auditoria esperada 1, veio %', v_aud;
  end if;

  select situacao_venda into v_sit from public.obter_evento_publico(v_slug);
  if v_sit <> 'VENDAS_ENCERRADAS' then
    raise exception 'C4: deveria estar VENDAS_ENCERRADAS, veio %', v_sit;
  end if;
  begin
    perform public.criar_reserva(v_evento, 'Comprador', '34999999999', 'c@gz1.local', array['P2']);
    raise exception 'C4: reserva deveria ser bloqueada';
  exception when sqlstate '23514' then
    if sqlerrm not like 'Vendas online encerradas%' then
      raise exception 'C4: erro inesperado: %', sqlerrm;
    end if;
  end;

  -- C5) leituras admin expoem o campo
  v_det := public.obter_evento_admin(v_evento);
  if v_det->>'vendas_encerram_em' is null then
    raise exception 'C5: obter_evento_admin sem vendas_encerram_em';
  end if;
  v_lista := public.listar_eventos_admin_filtrado(v_slug, null, null, null);
  if v_lista->0->>'vendas_encerram_em' is null then
    raise exception 'C5: listar_eventos_admin_filtrado sem vendas_encerram_em';
  end if;

  -- C6) limpar (null) volta a valer o inicio
  perform public.definir_encerramento_vendas_admin(v_evento, null);
  select situacao_venda into v_sit from public.obter_evento_publico(v_slug);
  if v_sit <> 'DISPONIVEL' then
    raise exception 'C6: deveria voltar a DISPONIVEL, veio %', v_sit;
  end if;
end $$;

select 'vendas_encerram_em: todos os testes passaram' as resultado;

rollback;
