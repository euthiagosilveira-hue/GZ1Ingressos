-- =============================================================================
-- Pagamento aprovado depois da reserva expirar ("pagamento tardio")
--
-- Problema (evento de 24/10): a rotina de manutencao expira reservas de 30 min
-- sem consultar o provedor. Se o Pix foi pago mas a confirmacao chegou depois
-- (webhook atrasado, cliente nao voltou a tela, Pix gerado depois do pedido),
-- confirmar_pagamento recusava o pedido EXPIRADO e o cliente ficava com o
-- ingresso expirado mesmo tendo pago.
--
-- Regra nova: o pagamento APROVADO pelo provedor e a fonte de verdade.
--   * Pedido RESERVADO (mesmo com prazo vencido): confirma normalmente.
--   * Pedido EXPIRADO: reativa -> pedido PAGO, pagamento APROVADO e ingressos
--     EXPIRADO -> VALIDO. Registra auditoria PAGAMENTO_TARDIO_CONFIRMADO.
--   * Pedido CANCELADO ou pagamento CANCELADO/REEMBOLSADO/REJEITADO: recusa.
-- O estoque pode passar do limite em casos raros (o dinheiro ja entrou).
-- =============================================================================

create or replace function private.confirmar_pagamento(
  p_pagamento_id uuid,
  p_transaction_id text default null,
  p_referencia_externa text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pagamento public.pagamentos%rowtype;
  v_pedido public.pedidos%rowtype;
  v_ingressos integer := 0;
  v_tardio boolean := false;
begin
  select * into v_pagamento
    from public.pagamentos pg
   where pg.id = p_pagamento_id
   for update;

  if not found then
    raise exception 'Pagamento % nao encontrado', p_pagamento_id using errcode = '23503';
  end if;

  select * into v_pedido
    from public.pedidos p
   where p.id = v_pagamento.pedido_id
   for update;

  if not found then
    raise exception 'Pedido % nao encontrado', v_pagamento.pedido_id using errcode = '23503';
  end if;

  -- idempotencia: confirmar duas vezes nao duplica efeitos
  if v_pedido.status = 'PAGO' and v_pagamento.status = 'APROVADO' then
    return jsonb_build_object(
      'pedido_id', v_pedido.id,
      'pagamento_id', v_pagamento.id,
      'status', 'PAGO',
      'resultado', 'ja_confirmado'
    );
  end if;

  if v_pedido.status not in ('RESERVADO', 'EXPIRADO') then
    raise exception 'Pedido % nao pode ser confirmado (status=%)', v_pedido.id, v_pedido.status
      using errcode = '23514';
  end if;

  if v_pagamento.status not in ('PENDENTE', 'EXPIRADO') then
    raise exception 'Pagamento % nao pode ser confirmado (status=%)', v_pagamento.id, v_pagamento.status
      using errcode = '23514';
  end if;

  if v_pagamento.valor <> v_pedido.valor_total then
    raise exception 'Pagamento % valor % difere do total % do pedido',
      v_pagamento.id, v_pagamento.valor, v_pedido.valor_total using errcode = '23514';
  end if;

  v_tardio := v_pedido.status = 'EXPIRADO' or now() >= v_pedido.reserva_expira_em;

  update public.pagamentos
     set status = 'APROVADO',
         confirmado_em = now(),
         transacao_id = coalesce(p_transaction_id, transacao_id),
         referencia_externa = coalesce(p_referencia_externa, referencia_externa)
   where id = v_pagamento.id;

  update public.pedidos
     set status = 'PAGO', pago_em = now()
   where id = v_pedido.id;

  update public.ingressos
     set status = 'VALIDO'
   where pedido_id = v_pedido.id and status in ('RESERVADO', 'EXPIRADO');
  get diagnostics v_ingressos = row_count;

  if v_tardio then
    insert into public.auditoria (usuario_id, acao, entidade, entidade_id, dados_anteriores, dados_novos)
    values (null, 'PAGAMENTO_TARDIO_CONFIRMADO', 'pedidos', v_pedido.id,
      jsonb_build_object('pedido_status', v_pedido.status, 'pagamento_status', v_pagamento.status,
        'reserva_expira_em', v_pedido.reserva_expira_em),
      jsonb_build_object('pedido_status', 'PAGO', 'pagamento_id', v_pagamento.id,
        'ingressos_validados', v_ingressos));
  end if;

  return jsonb_build_object(
    'pedido_id', v_pedido.id,
    'pagamento_id', v_pagamento.id,
    'status', 'PAGO',
    'ingressos_validados', v_ingressos,
    'tardio', v_tardio,
    'resultado', 'confirmado'
  );
end;
$$;

revoke all on function private.confirmar_pagamento(uuid, text, text) from public;
grant execute on function private.confirmar_pagamento(uuid, text, text) to service_role;
