import { exigirEquipe } from '../../utils/admin-auth'
import { liberarPedidosExpiradosPagos } from '../../utils/pagamentos-expirados'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIMITE_INGRESSOS = 20

/**
 * Portaria: a busca por nome achou ingressos EXPIRADOS. Pergunta ao Mercado
 * Pago se o Pix desses pedidos foi pago e, se sim, libera (pedido PAGO,
 * ingressos VALIDO). Devolve os ingressos liberados. ADMINISTRADOR ou PORTARIA.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ eventoId?: string; ingressoIds?: unknown }>(event).catch(
    () => null
  )
  const eventoId = String(body?.eventoId ?? '').trim()
  const ingressoIds = Array.isArray(body?.ingressoIds)
    ? [...new Set(body.ingressoIds.map((id) => String(id)).filter((id) => UUID_RE.test(id)))]
    : []
  if (!UUID_RE.test(eventoId) || ingressoIds.length === 0 || ingressoIds.length > LIMITE_INGRESSOS) {
    throw createError({ statusCode: 400, statusMessage: 'DADOS_INVALIDOS' })
  }

  const client = await exigirEquipe(event)
  const accessToken = useRuntimeConfig(event).mercadoPagoAccessToken
  if (!accessToken) throw createError({ statusCode: 503, statusMessage: 'PAGAMENTO_INDISPONIVEL' })

  const { data, error } = await client
    .from('ingressos')
    .select('id,pedido_id')
    .eq('evento_id', eventoId)
    .eq('status', 'EXPIRADO')
    .in('id', ingressoIds)
  if (error) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })

  const ingressos = (data ?? []) as { id: string; pedido_id: string }[]
  const pedidosLiberados = new Set(
    await liberarPedidosExpiradosPagos(
      client,
      [...new Set(ingressos.map((ingresso) => ingresso.pedido_id))],
      accessToken
    )
  )

  return {
    liberados: ingressos
      .filter((ingresso) => pedidosLiberados.has(ingresso.pedido_id))
      .map((ingresso) => ingresso.id)
  }
})
