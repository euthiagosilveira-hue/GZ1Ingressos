import { timingSafeEqual } from 'node:crypto'

import { serverSupabaseServiceRole } from '#supabase/server'

import { liberarPedidosExpiradosPagos } from '../../utils/pagamentos-expirados'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const LIMITE_PEDIDOS = 300

function mesmoSegredo(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Chamado pelo banco (pg_net) quando o evento comeca: confere no Mercado Pago
 * todos os pedidos EXPIRADOS do evento e libera os que foram pagos.
 * Autenticado pelo segredo de private.configuracoes (Authorization: Bearer).
 */
export default defineEventHandler(async (event) => {
  const client = serverSupabaseServiceRole(event)

  const { data: segredo, error: erroSegredo } = await client.rpc('obter_segredo_sistema')
  const recebido = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (erroSegredo || typeof segredo !== 'string' || !segredo || !mesmoSegredo(recebido, segredo)) {
    setResponseStatus(event, 401)
    return { error: 'NAO_AUTORIZADO' }
  }

  const body = await readBody<{ eventoId?: string }>(event).catch(() => null)
  const eventoId = String(body?.eventoId ?? '').trim()
  if (!UUID_RE.test(eventoId)) {
    setResponseStatus(event, 400)
    return { error: 'DADOS_INVALIDOS' }
  }

  const accessToken = useRuntimeConfig(event).mercadoPagoAccessToken
  if (!accessToken) {
    setResponseStatus(event, 503)
    return { error: 'PAGAMENTO_INDISPONIVEL' }
  }

  const { data, error } = await client
    .from('pedidos')
    .select('id')
    .eq('evento_id', eventoId)
    .eq('status', 'EXPIRADO')
    .order('criado_em', { ascending: false })
    .limit(LIMITE_PEDIDOS)
  if (error) {
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }

  const pedidoIds = (data ?? []).map((pedido: { id: string }) => pedido.id)
  const liberados = await liberarPedidosExpiradosPagos(client, pedidoIds, accessToken)
  console.info('[conferencia-pagamentos]', { eventoId, conferidos: pedidoIds.length, liberados: liberados.length })
  return { conferidos: pedidoIds.length, liberados: liberados.length }
})
