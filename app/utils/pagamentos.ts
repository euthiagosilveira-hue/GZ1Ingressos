import type { PaymentProvider } from '~/types/pagamento'

const ROTULOS: Record<PaymentProvider, string> = {
  STONE: 'Stone',
  MERCADO_PAGO: 'Mercado Pago'
}

export function rotuloProvider(provider: PaymentProvider): string {
  return ROTULOS[provider]
}
