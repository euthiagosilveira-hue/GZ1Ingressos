-- =============================================================================
-- GZ1 Ingresso - Testes: acesso de ACOMPANHAMENTO das vendas
-- Arquivo: supabase/tests/acompanhamento_eventos.test.sql
-- Executar como owner. begin/rollback.
--
--   A) ACOMPANHAMENTO ve so os eventos em que foi adicionado
--   B) resumo: ingressos, R$, por lote, por dia; pendente nao conta
--   C) lista de compradores sem telefone/e-mail
--   D) evento de outro / nao vinculado -> "Evento nao encontrado"
--   E) PORTARIA / PRODUTOR nao usam as funcoes de acompanhamento
--   F) acompanhante nao usa funcoes de admin
--   G) admin lista e remove o acompanhante; acesso some
--   H) usuario inativo perde o acesso
-- =============================================================================

begin;

do $$
begin
  if has_function_privilege('anon', 'public.listar_eventos_acompanhamento()', 'EXECUTE') then
    raise exception 'ACL: anon nao pode executar listar_eventos_acompanhamento';
  end if;
  if has_table_privilege('authenticated', 'public.eventos_acompanhantes', 'SELECT') then
    raise exception 'ACL: authenticated nao pode ler eventos_acompanhantes direto';
  end if;
end $$;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_acomp uuid := gen_random_uuid();
  v_port uuid := gen_random_uuid();
  v_e uuid;
  v_e2 uuid;
  v_r jsonb;
  v_pag jsonb;
  v_res jsonb;
  v_lista jsonb;
  v_ok boolean;
begin
  insert into auth.users (id) values (v_admin), (v_acomp), (v_port);
  insert into public.usuarios (id, nome, email, perfil, ativo) values
    (v_admin, 'Admin Ac', 'adminac_' || replace(v_admin::text,'-','') || '@test.local', 'ADMINISTRADOR', true),
    (v_acomp, 'Socio Ac', 'socioac_' || replace(v_acomp::text,'-','') || '@test.local', 'ACOMPANHAMENTO', true),
    (v_port, 'Port Ac', 'portac_' || replace(v_port::text,'-','') || '@test.local', 'PORTARIA', true);

  insert into public.eventos (nome, slug, inicio_em, local, endereco, capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status)
  values ('Evento Ac','ac-'||replace(gen_random_uuid()::text,'-',''), now()+interval '3 days','L','E',100,50,'AGENDADO','PUBLICADO','ABERTAS') returning id into v_e;
  insert into public.eventos (nome, slug, inicio_em, local, endereco, capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status)
  values ('Evento Ac 2','ac2-'||replace(gen_random_uuid()::text,'-',''), now()+interval '5 days','L','E',100,50,'AGENDADO','PUBLICADO','ABERTAS') returning id into v_e2;
  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, status) values (v_e,'Lote 1',1,100,40,'MANUAL','ATIVO');
  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, status) values (v_e,'Lote 2',2,100,60,'MANUAL','INATIVO');
  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, status) values (v_e2,'Lote X',1,100,10,'MANUAL','ATIVO');

  -- pedido PAGO com 2 ingressos (R$ 80)
  v_r := public.criar_reserva(v_e,'Comprador Ac','11999990070','ac@test.local',array['Ac 1','Ac 2']);
  v_pag := public.criar_pagamento_pendente_por_token((v_r->>'checkout_token')::uuid,'MERCADO_PAGO');
  perform public.confirmar_pagamento((v_pag->>'pagamento_id')::uuid,'tx-ac-1');
  update public.ingressos set status='UTILIZADO', utilizado_em=now()
   where id = (select id from public.ingressos where pedido_id=(v_r->>'pedido_id')::uuid order by codigo limit 1);

  -- pedido PENDENTE (nao conta)
  v_r := public.criar_reserva(v_e,'Comprador Pendente','11999990071',null,array['Ac P']);
  perform public.criar_pagamento_pendente_por_token((v_r->>'checkout_token')::uuid,'MERCADO_PAGO');

  -- pedido PAGO no outro evento
  v_r := public.criar_reserva(v_e2,'Comprador Outro','11999990072',null,array['Ac O']);
  v_pag := public.criar_pagamento_pendente_por_token((v_r->>'checkout_token')::uuid,'MERCADO_PAGO');
  perform public.confirmar_pagamento((v_pag->>'pagamento_id')::uuid,'tx-ac-2');

  -- vinculo (o servidor faz este insert com service role)
  insert into public.eventos_acompanhantes (evento_id, usuario_id, criado_por) values (v_e, v_acomp, v_admin);

  -- ---------------------------------------------------------------- A
  perform set_config('request.jwt.claims', json_build_object('sub', v_acomp::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_acomp::text, true);

  v_lista := public.listar_eventos_acompanhamento();
  if jsonb_array_length(v_lista) <> 1 then raise exception 'A: esperado 1 evento, obtido %', v_lista; end if;
  if (v_lista->0->>'evento_id')::uuid <> v_e then raise exception 'A: evento errado'; end if;
  if (v_lista->0->>'ingressos')::int <> 2 then raise exception 'A: ingressos %', v_lista->0->>'ingressos'; end if;
  if (v_lista->0->>'valor_total')::numeric <> 80 then raise exception 'A: valor %', v_lista->0->>'valor_total'; end if;

  -- ---------------------------------------------------------------- B
  v_res := public.obter_evento_acompanhamento(v_e);
  if (v_res->'resumo'->>'ingressos')::int <> 2 then raise exception 'B: ingressos %', v_res->'resumo'; end if;
  if (v_res->'resumo'->>'valor_total')::numeric <> 80 then raise exception 'B: valor_total'; end if;
  if (v_res->'resumo'->>'valor_online')::numeric <> 80 then raise exception 'B: valor_online'; end if;
  if (v_res->'resumo'->>'pedidos_pagos')::int <> 1 then raise exception 'B: pedidos_pagos'; end if;
  if (v_res->>'utilizados')::int <> 1 then raise exception 'B: utilizados'; end if;
  if jsonb_array_length(v_res->'resumo'->'por_lote') <> 2 then raise exception 'B: por_lote %', v_res->'resumo'->'por_lote'; end if;
  if (v_res->'resumo'->'por_lote'->0->>'nome') <> 'Lote 1'
     or (v_res->'resumo'->'por_lote'->0->>'ingressos')::int <> 2
     or (v_res->'resumo'->'por_lote'->0->>'valor')::numeric <> 80
     or (v_res->'resumo'->'por_lote'->1->>'ingressos')::int <> 0 then
    raise exception 'B: valores por lote %', v_res->'resumo'->'por_lote';
  end if;
  if jsonb_array_length(v_res->'resumo'->'por_dia') <> 1
     or (v_res->'resumo'->'por_dia'->0->>'valor')::numeric <> 80 then
    raise exception 'B: por_dia %', v_res->'resumo'->'por_dia';
  end if;
  if (v_res->'lote_ativo'->>'nome') <> 'Lote 1' then raise exception 'B: lote_ativo'; end if;

  -- ---------------------------------------------------------------- C
  v_lista := public.listar_vendas_evento_acompanhamento(v_e);
  if jsonb_array_length(v_lista) <> 1 then raise exception 'C: esperado 1 venda, obtido %', v_lista; end if;
  if (v_lista->0->>'comprador_nome') <> 'Comprador Ac' then raise exception 'C: nome'; end if;
  if (v_lista->0->>'lote_nome') <> 'Lote 1' then raise exception 'C: lote_nome'; end if;
  if v_lista::text ilike '%11999990070%' or v_lista::text ilike '%ac@test.local%'
     or (v_lista->0) ? 'comprador_telefone' or (v_lista->0) ? 'comprador_email' then
    raise exception 'C: vazou contato do comprador';
  end if;

  -- ---------------------------------------------------------------- D
  v_ok := false;
  begin
    perform public.obter_evento_acompanhamento(v_e2);
  exception when others then
    v_ok := sqlerrm ilike '%evento nao encontrado%';
  end;
  if not v_ok then raise exception 'D: evento nao vinculado deveria ser bloqueado'; end if;

  v_ok := false;
  begin
    perform public.listar_vendas_evento_acompanhamento(v_e2);
  exception when others then
    v_ok := sqlerrm ilike '%evento nao encontrado%';
  end;
  if not v_ok then raise exception 'D: vendas de evento nao vinculado deveriam ser bloqueadas'; end if;

  -- ---------------------------------------------------------------- F
  v_ok := false;
  begin
    perform public.listar_acompanhantes_evento_admin(v_e);
  exception when others then
    v_ok := sqlstate = '42501';
  end;
  if not v_ok then raise exception 'F: acompanhante nao pode usar funcao de admin'; end if;

  v_ok := false;
  begin
    perform public.obter_dashboard_admin();
  exception when others then
    v_ok := sqlstate = '42501';
  end;
  if not v_ok then raise exception 'F: acompanhante nao pode ver dashboard admin'; end if;

  -- ---------------------------------------------------------------- E
  perform set_config('request.jwt.claims', json_build_object('sub', v_port::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_port::text, true);
  v_ok := false;
  begin
    perform public.listar_eventos_acompanhamento();
  exception when others then
    v_ok := sqlstate = '42501';
  end;
  if not v_ok then raise exception 'E: PORTARIA nao pode usar acompanhamento'; end if;

  -- ---------------------------------------------------------------- G
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  v_lista := public.listar_acompanhantes_evento_admin(v_e);
  if jsonb_array_length(v_lista) <> 1 or (v_lista->0->>'usuario_id')::uuid <> v_acomp then
    raise exception 'G: lista de acompanhantes %', v_lista;
  end if;
  v_lista := public.listar_acompanhantes_admin();
  if not exists (select 1 from jsonb_array_elements(v_lista) x where (x->>'usuario_id')::uuid = v_acomp) then
    raise exception 'G: acompanhante deveria aparecer na lista geral';
  end if;

  -- H) usuario inativo perde acesso (antes de remover o vinculo)
  update public.usuarios set ativo = false where id = v_acomp;
  perform set_config('request.jwt.claims', json_build_object('sub', v_acomp::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_acomp::text, true);
  v_ok := false;
  begin
    perform public.obter_evento_acompanhamento(v_e);
  exception when others then
    v_ok := sqlstate = '42501';
  end;
  if not v_ok then raise exception 'H: usuario inativo deveria perder o acesso'; end if;
  update public.usuarios set ativo = true where id = v_acomp;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform public.remover_acompanhante_evento_admin(v_e, v_acomp);
  if not exists (select 1 from public.auditoria where acao = 'ACOMPANHANTE_REMOVIDO' and entidade_id = v_e) then
    raise exception 'G: remocao deveria ser auditada';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', v_acomp::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_acomp::text, true);
  if jsonb_array_length(public.listar_eventos_acompanhamento()) <> 0 then
    raise exception 'G: depois de removido nao deveria ver eventos';
  end if;

  raise notice 'acompanhamento_eventos: OK';
end $$;

rollback;
