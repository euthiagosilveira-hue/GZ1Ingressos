import type { H3Event } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import type { PaymentProvider } from './payment-provider'
import { MercadoPagoProvider } from './mercado-pago/mercado-pago-provider'
import { MercadoPagoPaymentsProvider } from './mercado-pago/mercado-pago-payments'
import { obterAccessTokenProdutor } from './mercado-pago/mercado-pago-conexao'

/**
 * Quem recebe o Pix de um pagamento:
 *  - pagamento com produtor_recebedor_id (evento em sociedade) -> Payments API
 *    com o token do produtor;
 *  - caso contrario -> Orders API com o token da galeria (como sempre foi).
 */

export interface SociedadeRecebedor {
  produtorId: string
  percentualGaleria: number
}

/** Sociedade do evento (produtor recebedor + % da galeria) ou null. */
export async function obterSociedadeDoEvento(
  event: H3Event,
  eventoId: string
): Promise<SociedadeRecebedor | null> {
  const client = serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('eventos_sociedade')
    .select('produtor_id,percentual_galeria')
    .eq('evento_id', eventoId)
    .maybeSingle()
  if (error) throw new Error('Falha ao ler a sociedade do evento.')
  if (!data) return null
  return { produtorId: String(data.produtor_id), percentualGaleria: Number(data.percentual_galeria) }
}

/**
 * Provider para consultar um pagamento ja criado. Devolve null quando o
 * produtor do pagamento nao tem mais conta conectada (nao da para consultar).
 */
export async function providerParaPagamento(
  event: H3Event,
  produtorRecebedorId: string | null | undefined,
  tokenGaleria: string
): Promise<PaymentProvider | null> {
  if (produtorRecebedorId) {
    const token = await obterAccessTokenProdutor(event, produtorRecebedorId)
    return token ? new MercadoPagoPaymentsProvider(token) : null
  }
  return tokenGaleria ? new MercadoPagoProvider(tokenGaleria) : null
}

/** produtor_recebedor_id de um pagamento (service role). */
export async function produtorRecebedorDoPagamento(
  event: H3Event,
  pagamentoId: string
): Promise<string | null> {
  const client = serverSupabaseServiceRole(event)
  const { data } = await client
    .from('pagamentos')
    .select('produtor_recebedor_id')
    .eq('id', pagamentoId)
    .maybeSingle()
  return data?.produtor_recebedor_id ? String(data.produtor_recebedor_id) : null
}
