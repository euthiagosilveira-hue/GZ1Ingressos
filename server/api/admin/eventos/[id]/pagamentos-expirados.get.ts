import { exigirAdmin } from '../../../../utils/admin-auth'
import { conferirPedidosExpirados, lerEventoIdDaRota } from '../../../../utils/pagamentos-expirados'

/**
 * Lista os pedidos EXPIRADOS do evento e, para cada um, se o Mercado Pago
 * recebeu o Pix. So ADMINISTRADOR. Somente leitura.
 */
export default defineEventHandler(async (event) => {
  const eventoId = lerEventoIdDaRota(event)
  const admin = await exigirAdmin(event)
  const accessToken = useRuntimeConfig(event).mercadoPagoAccessToken
  if (!accessToken) throw createError({ statusCode: 503, statusMessage: 'PAGAMENTO_INDISPONIVEL' })

  const pedidos = await conferirPedidosExpirados(admin, eventoId, accessToken)
  return { pedidos }
})
