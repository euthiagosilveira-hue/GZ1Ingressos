import type { SupabaseClient } from '@supabase/supabase-js'

import { MercadoPagoProvider } from '../services/payments/mercado-pago/mercado-pago-provider'

interface PedidoExpiradoBanco {
  id: string
  pagamentos:
    | { id: string; provedor: string; cobranca_id: string | null }
    | { id: string; provedor: string; cobranca_id: string | null }[]
    | null
}

const CONSULTAS_SIMULTANEAS = 5

function primeiroPagamento(pedido: PedidoExpiradoBanco) {
  const pg = pedido.pagamentos
  if (!pg) return null
  return Array.isArray(pg) ? (pg[0] ?? null) : pg
}

/**
 * Confere no Mercado Pago os pedidos EXPIRADOS informados e confirma os que
 * foram pagos (confirmar_pagamento aceita pagamento tardio: pedido volta a
 * PAGO e ingressos a VALIDO). So confirma quando a Order esta aprovada E
 * aponta para o mesmo pagamento interno (external_reference).
 * Devolve os ids dos pedidos liberados. Falhas de consulta sao ignoradas
 * (a proxima conferencia tenta de novo).
 */
export async function liberarPedidosExpiradosPagos(
  client: SupabaseClient,
  pedidoIds: string[],
  accessToken: string
): Promise<string[]> {
  if (pedidoIds.length === 0) return []

  const { data, error } = await client
    .from('pedidos')
    .select('id,pagamentos(id,provedor,cobranca_id)')
    .in('id', pedidoIds)
    .eq('status', 'EXPIRADO')
  if (error) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })

  const pedidos = (data ?? []) as unknown as PedidoExpiradoBanco[]
  const provider = new MercadoPagoProvider(accessToken)

  async function conferir(pedido: PedidoExpiradoBanco): Promise<string | null> {
    const pagamento = primeiroPagamento(pedido)
    if (!pagamento || pagamento.provedor !== 'MERCADO_PAGO' || !pagamento.cobranca_id) return null
    try {
      const charge = await provider.getCharge(pagamento.cobranca_id)
      if (charge.status !== 'APROVADO' || charge.externalReference !== pagamento.id) return null
      const { error: erroConfirmacao } = await client.rpc('confirmar_pagamento', {
        p_pagamento_id: pagamento.id,
        p_transaction_id: charge.transactionId,
        p_referencia_externa: pagamento.id
      })
      return erroConfirmacao ? null : pedido.id
    } catch {
      return null
    }
  }

  const liberados: string[] = []
  for (let i = 0; i < pedidos.length; i += CONSULTAS_SIMULTANEAS) {
    const lote = await Promise.all(pedidos.slice(i, i + CONSULTAS_SIMULTANEAS).map(conferir))
    liberados.push(...lote.filter((id): id is string => id !== null))
  }
  return liberados
}
