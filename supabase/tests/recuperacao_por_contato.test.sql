-- =============================================================================
-- GZ1 Ingresso - Testes: recuperacao de ingressos por telefone + e-mail
-- Arquivo: supabase/tests/recuperacao_por_contato.test.sql
-- Executar como owner. begin/rollback.
-- =============================================================================

begin;

do $$
declare
  v_e uuid;
  v_r jsonb; v_pag jsonb; v_res jsonb;
  v_ped1 uuid; v_ped2 uuid; v_pedR uuid;
  i integer;
begin
  insert into public.eventos (nome, slug, inicio_em, local, endereco, capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status)
  values ('Evento RecC','recc-'||replace(gen_random_uuid()::text,'-',''), now()+interval '3 days','L','E',100,50,'AGENDADO','PUBLICADO','ABERTAS')
  returning id into v_e;
  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, status)
  values (v_e,'Lote RC',1,100,40,'MANUAL','ATIVO');

  -- Dois pedidos PAGOS do mesmo comprador
  v_r := public.criar_reserva(v_e,'Comprador RC','(11) 99999-0030','Compra@Test.local',array['RC 1']);
  v_ped1 := (v_r->>'pedido_id')::uuid;
  v_pag := public.criar_pagamento_pendente_por_token((v_r->>'checkout_token')::uuid,'MERCADO_PAGO');
  perform public.confirmar_pagamento((v_pag->>'pagamento_id')::uuid,'tx-recc-1');

  v_r := public.criar_reserva(v_e,'Comprador RC','11999990030','compra@test.local',array['RC 2']);
  v_ped2 := (v_r->>'pedido_id')::uuid;
  v_pag := public.criar_pagamento_pendente_por_token((v_r->>'checkout_token')::uuid,'MERCADO_PAGO');
  perform public.confirmar_pagamento((v_pag->>'pagamento_id')::uuid,'tx-recc-2');

  -- Pedido RESERVADO (nao pago) do mesmo comprador
  v_r := public.criar_reserva(v_e,'Comprador RC','11999990030','compra@test.local',array['RC 3']);
  v_pedR := (v_r->>'pedido_id')::uuid;

  -- A) telefone com DDI e e-mail com maiusculas => 2 pedidos pagos
  v_r := public.recuperar_ingressos_contato('+55 11 99999-0030', '  COMPRA@test.local ');
  if (v_r->>'ok')::boolean is not true then raise exception 'A: deveria recuperar'; end if;
  if jsonb_array_length(v_r->'pedidos') <> 2 then raise exception 'A: esperado 2 pedidos, veio %', v_r->'pedidos'; end if;
  if v_r::text like '%checkout_token%' or v_r::text like '%qr_token%' then
    raise exception 'A: nao pode expor tokens do pedido';
  end if;

  -- B) token devolvido abre os ingressos
  v_res := public.obter_ingressos_recuperacao(v_r->'pedidos'->0->>'token');
  if v_res is null or jsonb_array_length(v_res->'ingressos') < 1 then
    raise exception 'B: token deveria abrir os ingressos';
  end if;

  -- C) e-mail errado => generico
  v_r := public.recuperar_ingressos_contato('11999990030', 'outro@test.local');
  if (v_r->>'ok')::boolean is not false or v_r ? 'pedidos' then raise exception 'C: deveria falhar'; end if;

  -- D) telefone errado => generico
  v_r := public.recuperar_ingressos_contato('11999990039', 'compra@test.local');
  if (v_r->>'ok')::boolean is not false then raise exception 'D: deveria falhar'; end if;

  -- E) dados vazios/invalidos => generico
  if (public.recuperar_ingressos_contato('', '')->>'ok')::boolean is not false then raise exception 'E1'; end if;
  if (public.recuperar_ingressos_contato('11999990030', 'semarroba')->>'ok')::boolean is not false then raise exception 'E2'; end if;

  -- F) rate limit: apos 5 falhas no telefone, ate o correto e negado
  for i in 1..5 loop
    perform public.recuperar_ingressos_contato('11999990031', 'x'||i||'@test.local');
  end loop;
  update public.pedidos set comprador_telefone = '11999990031' where id = v_ped1;
  v_r := public.recuperar_ingressos_contato('11999990031', 'compra@test.local');
  if (v_r->>'ok')::boolean is not false then raise exception 'F: rate limit deveria bloquear'; end if;
end $$;

select 'recuperacao_por_contato: todos os testes passaram' as resultado;

rollback;
