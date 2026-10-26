-- =============================================================================
-- GZ1 Ingresso - Testes: pagamento aprovado depois da reserva expirar
-- Arquivo: supabase/tests/pagamento_tardio.test.sql
-- Executar como owner/service_role. begin/rollback (nao persiste dados).
-- =============================================================================

begin;

do $$
declare
  v_evento_id uuid;
  v_r jsonb;
  v_pedido uuid;
  v_pag jsonb;
  v_pag_id uuid;
  v_res jsonb;
  v_falhou boolean;
begin
  insert into public.eventos (
    nome, slug, inicio_em, local, endereco,
    capacidade_total, estoque_antecipado, status, publicacao_status, vendas_status
  ) values (
    'Teste Pagamento Tardio', 'teste-tardio-' || replace(gen_random_uuid()::text, '-', ''),
    now() + interval '20 days', 'Local T', 'End T',
    200, 100, 'AGENDADO', 'PUBLICADO', 'ABERTAS'
  ) returning id into v_evento_id;

  insert into public.lotes (evento_id, nome, ordem, quantidade, preco, tipo_ativacao, status)
  values (v_evento_id, 'Lote T', 1, 100, 40, 'MANUAL', 'ATIVO');

  -- A) Pix pago depois que a rotina expirou o pedido => volta a PAGO ---------
  v_r := public.criar_reserva(v_evento_id, 'Comprador T', '34999999980', null, array['T1', 'T2']);
  v_pedido := (v_r->>'pedido_id')::uuid;
  v_pag := public.criar_pagamento_pendente_por_token((v_r->>'checkout_token')::uuid, 'MERCADO_PAGO');
  v_pag_id := (v_pag->>'pagamento_id')::uuid;

  update public.pedidos set reserva_expira_em = now() - interval '1 minute' where id = v_pedido;
  update public.pagamentos set expira_em = null where id = v_pag_id;
  perform public.processar_reservas_expiradas(v_evento_id);
  if (select status from public.pedidos where id = v_pedido) <> 'EXPIRADO' then
    raise exception 'A: pedido deveria estar EXPIRADO antes da confirmacao';
  end if;

  v_res := public.confirmar_pagamento(v_pag_id, 'tx-tardio-1');
  if v_res->>'resultado' <> 'confirmado' or not (v_res->>'tardio')::boolean then
    raise exception 'A: esperado confirmado/tardio, veio %', v_res;
  end if;
  if (select status from public.pedidos where id = v_pedido) <> 'PAGO' then
    raise exception 'A: pedido deveria voltar a PAGO';
  end if;
  if (select status from public.pagamentos where id = v_pag_id) <> 'APROVADO' then
    raise exception 'A: pagamento deveria estar APROVADO';
  end if;
  if exists (select 1 from public.ingressos where pedido_id = v_pedido and status <> 'VALIDO') then
    raise exception 'A: todos os ingressos deveriam estar VALIDO';
  end if;
  if not exists (
    select 1 from public.auditoria
     where acao = 'PAGAMENTO_TARDIO_CONFIRMADO' and entidade_id = v_pedido
  ) then
    raise exception 'A: auditoria PAGAMENTO_TARDIO_CONFIRMADO ausente';
  end if;

  -- B) idempotente: webhook repetido nao duplica ---------------------------
  v_res := public.confirmar_pagamento(v_pag_id, 'tx-tardio-1');
  if v_res->>'resultado' <> 'ja_confirmado' then
    raise exception 'B: esperado ja_confirmado, veio %', v_res;
  end if;

  -- C) prazo vencido mas rotina ainda nao rodou => confirma -----------------
  v_r := public.criar_reserva(v_evento_id, 'Comprador U', '34999999981', null, array['U1']);
  v_pedido := (v_r->>'pedido_id')::uuid;
  v_pag := public.criar_pagamento_pendente_por_token((v_r->>'checkout_token')::uuid, 'MERCADO_PAGO');
  update public.pagamentos set expira_em = null where id = (v_pag->>'pagamento_id')::uuid;
  update public.pedidos set reserva_expira_em = now() - interval '5 seconds' where id = v_pedido;
  perform public.confirmar_pagamento((v_pag->>'pagamento_id')::uuid, 'tx-tardio-2');
  if (select status from public.pedidos where id = v_pedido) <> 'PAGO' then
    raise exception 'C: pedido com prazo vencido deveria ser confirmado';
  end if;

  -- D) pedido CANCELADO continua recusado ------------------------------------
  v_r := public.criar_reserva(v_evento_id, 'Comprador V', '34999999982', null, array['V1']);
  v_pedido := (v_r->>'pedido_id')::uuid;
  v_pag := public.criar_pagamento_pendente_por_token((v_r->>'checkout_token')::uuid, 'MERCADO_PAGO');
  update public.pedidos set status = 'CANCELADO', cancelado_em = now() where id = v_pedido;
  v_falhou := false;
  begin
    perform public.confirmar_pagamento((v_pag->>'pagamento_id')::uuid, 'tx-tardio-3');
  exception when others then
    v_falhou := true;
  end;
  if not v_falhou then
    raise exception 'D: pedido CANCELADO nao pode ser confirmado';
  end if;

  raise notice 'pagamento_tardio: OK';
end;
$$;

rollback;
