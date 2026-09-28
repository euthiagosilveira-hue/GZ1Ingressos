import type { CreatePixChargeInput, PaymentProvider, PixCharge } from '../payment-provider'
import { MercadoPagoClient } from './mercado-pago-client'
import { mapMpOrderToCharge } from './mercado-pago-mapper'
import type { MpCreateOrderRequest } from './mercado-pago-types'

const MINUTOS_MINIMOS = 30

function formatarValor(valor: number): string {
  return valor.toFixed(2)
}

function duracaoIso(minutos: number): string {
  return `PT${Math.max(MINUTOS_MINIMOS, Math.ceil(minutos))}M`
}

export class MercadoPagoProvider implements PaymentProvider {
  readonly name = 'MERCADO_PAGO' as const
  private readonly client: MercadoPagoClient

  constructor(accessToken: string) {
    this.client = new MercadoPagoClient(accessToken)
  }

  async createPixCharge(input: CreatePixChargeInput): Promise<PixCharge> {
    const amount = formatarValor(input.amount)

    const payload: MpCreateOrderRequest = {
      type: 'online',
      total_amount: amount,
      external_reference: input.externalReference,
      processing_mode: 'automatic',
      transactions: {
        payments: [
          {
            amount,
            payment_method: { id: 'pix', type: 'bank_transfer' },
            expiration_time: duracaoIso(input.expirationMinutes)
          }
        ]
      },
      payer: { email: input.payerEmail }
    }

    const order = await this.client.createOrder(payload, input.idempotencyKey)
    return mapMpOrderToCharge(order)
  }

  async getCharge(chargeId: string): Promise<PixCharge> {
    const order = await this.client.getOrder(chargeId)
    return mapMpOrderToCharge(order)
  }
}
