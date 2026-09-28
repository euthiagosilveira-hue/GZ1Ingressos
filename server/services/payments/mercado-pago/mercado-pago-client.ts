import type { MpCreateOrderRequest, MpOrder } from './mercado-pago-types'

const BASE_URL = 'https://api.mercadopago.com'

export class MercadoPagoHttpError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'MercadoPagoHttpError'
    this.status = status
  }
}

export class MercadoPagoClient {
  private readonly accessToken: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...(init.headers ?? {})
      }
    })

    if (!response.ok) {
      const texto = await response.text().catch(() => '')
      throw new MercadoPagoHttpError(response.status, texto.slice(0, 300))
    }

    return (await response.json()) as T
  }

  createOrder(payload: MpCreateOrderRequest, idempotencyKey: string): Promise<MpOrder> {
    return this.request<MpOrder>('/v1/orders', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload)
    })
  }

  getOrder(orderId: string): Promise<MpOrder> {
    return this.request<MpOrder>(`/v1/orders/${encodeURIComponent(orderId)}`, { method: 'GET' })
  }
}
