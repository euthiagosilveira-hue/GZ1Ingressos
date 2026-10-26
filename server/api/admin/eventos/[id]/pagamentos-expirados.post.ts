import { exigirAdmin } from '../../../../utils/admin-auth'
import {
  conferirPedidosExpirados,
  lerEventoIdDaRota,
  liberarPedidosPagos
} from '../../../../utils/pagamentos-expirados'

/**
 * Libera os pedidos EXPIRADOS do evento que o Mercado Pago confirma como
 * pagos. Confere de novo no provedor (nao confia na lista do navegador).
 * So ADMINISTRADOR.
 */
export default defineEventHandler(async (event) => {
  const eventoId = lerEventoIdDaRota(event)
  const admin = await exigirAdmin(event)
  const accessToken = useRuntimeConfig(event).mercadoPagoAccessToken
  if (!accessToken) throw createError({ statusCode: 503, statusMessage: 'PAGAMENTO_INDISPONIVEL' })

  const conferidos = await conferirPedidosExpirados(admin, eventoId, accessToken)
  return await liberarPedidosPagos(admin, conferidos)
})
