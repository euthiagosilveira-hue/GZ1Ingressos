import type { Gz1PaymentStatus, PixCharge } from '../payment-provider'
import type { MpOrder, MpTransactionPayment } from './mercado-pago-types'

/**
 * Mapeia status/status_detail do Mercado Pago para o status interno GZ1.
 * Fonte oficial: docs/checkout-api-orders/payment-management/status/transaction-status
 */
export function mapMpStatus(status: string, statusDetail?: string | null): Gz1PaymentStatus {
  const s = (status || '').toLowerCase()
  const d = (statusDetail || '').toLowerCase()

  if (s === 'processed' && d === 'accredited') return 'APROVADO'
  if (s === 'processed' && (d === 'refunded' || d === 'partially_refunded')) return 'REEMBOLSADO'
  if (s === 'refunded' || d === 'refunded') return 'REEMBOLSADO'
  if (s === 'charged_back') return 'CANCELADO'
  if (s === 'canceled' || d === 'canceled') return 'CANCELADO'
  if (s === 'expired' || d === 'expired') return 'EXPIRADO'
  if (s === 'failed') return 'REJEITADO'
  return 'PENDENTE'
}

function primeiroPagamento(order: MpOrder): MpTransactionPayment | null {
  const payments = order.transactions?.payments
  if (!payments || payments.length === 0) return null
  return payments[0]
}

export function mapMpOrderToCharge(order: MpOrder): PixCharge {
  const pagamento = primeiroPagamento(order)
  const metodo = pagamento?.payment_method ?? null
  const status = mapMpStatus(pagamento?.status ?? order.status, pagamento?.status_detail ?? order.status_detail)

  return {
    provider: 'MERCADO_PAGO',
    transactionId: pagamento?.id ?? null,
    chargeId: order.id,
    externalReference: order.external_reference ?? '',
    status,
    pixCopyPaste: metodo?.qr_code ?? null,
    pixQrCode: metodo?.qr_code_base64 ?? null,
    expiresAt: null
  }
}
