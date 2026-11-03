import { assinarEstado } from '../../../utils/mercado-pago-cripto'
import { exigirProdutorAtivo } from '../../../utils/admin-auth'
import { montarUrlAutorizacao } from '../../../services/payments/mercado-pago/mercado-pago-oauth'

const VALIDADE_ESTADO_MS = 10 * 60 * 1000
const DESTINO = '/produtor'

/**
 * O PRODUTOR logado conecta a propria conta Mercado Pago (marketplace).
 * Redireciona para a autorizacao do Mercado Pago com um `state` assinado
 * (produtor + usuario + validade), conferido no callback.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const clientId = String(config.mercadoPagoClientId ?? '')
  const tokenKey = String(config.mercadoPagoTokenKey ?? '')

  if (!clientId || !config.mercadoPagoClientSecret || tokenKey.length < 32) {
    return sendRedirect(event, `${DESTINO}?mp=indisponivel`, 302)
  }

  let produtor
  try {
    produtor = await exigirProdutorAtivo(event)
  } catch {
    return sendRedirect(event, `${DESTINO}?mp=sem-permissao`, 302)
  }

  const siteUrl = String(config.public.siteUrl || getRequestURL(event).origin).replace(/\/+$/, '')
  const state = assinarEstado(
    { o: produtor.produtorId, u: produtor.usuarioId, e: Date.now() + VALIDADE_ESTADO_MS },
    tokenKey
  )

  return sendRedirect(
    event,
    montarUrlAutorizacao({ clientId, redirectUri: `${siteUrl}/api/mercadopago/oauth/callback`, state }),
    302
  )
})
