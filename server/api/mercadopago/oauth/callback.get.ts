import { verificarEstado } from '../../../utils/mercado-pago-cripto'
import { exigirProdutorAtivo } from '../../../utils/admin-auth'
import { trocarCodigoPorToken } from '../../../services/payments/mercado-pago/mercado-pago-oauth'
import { salvarConexaoProdutor } from '../../../services/payments/mercado-pago/mercado-pago-conexao'

const DESTINO = '/produtor'

/**
 * Retorno do OAuth do Mercado Pago (conta do produtor).
 *  1. confere o `state` assinado (produtor, usuario, validade);
 *  2. confere que a sessao atual e do mesmo usuario e que ele continua
 *     PRODUTOR ativo do mesmo cadastro;
 *  3. troca o `code` pelo token, cifra e grava a conexao (service role);
 *  4. volta para a area do produtor com o resultado.
 * Nunca devolve nem registra tokens.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const query = getQuery(event)
  const code = String(query.code ?? '').trim()
  const state = String(query.state ?? '').trim()
  const tokenKey = String(config.mercadoPagoTokenKey ?? '')

  if (query.error || !code || !state || tokenKey.length < 32) {
    return sendRedirect(event, `${DESTINO}?mp=erro`, 302)
  }

  const estado = verificarEstado(state, tokenKey, Date.now())
  if (!estado) return sendRedirect(event, `${DESTINO}?mp=expirado`, 302)

  try {
    const produtor = await exigirProdutorAtivo(event)
    if (produtor.usuarioId !== estado.u || produtor.produtorId !== estado.o) {
      return sendRedirect(event, `${DESTINO}?mp=sem-permissao`, 302)
    }
  } catch {
    return sendRedirect(event, `${DESTINO}?mp=sem-permissao`, 302)
  }

  const siteUrl = String(config.public.siteUrl || getRequestURL(event).origin).replace(/\/+$/, '')
  try {
    const token = await trocarCodigoPorToken({
      clientId: String(config.mercadoPagoClientId ?? ''),
      clientSecret: String(config.mercadoPagoClientSecret ?? ''),
      code,
      redirectUri: `${siteUrl}/api/mercadopago/oauth/callback`,
      testToken: String(config.mercadoPagoOauthTestToken ?? 'false') === 'true'
    })
    await salvarConexaoProdutor(event, estado.o, estado.u, token)
  } catch (erro) {
    console.error('[mercado-pago] callback OAuth do produtor falhou', {
      produtorId: estado.o,
      mensagem: erro instanceof Error ? erro.message : 'erro'
    })
    return sendRedirect(event, `${DESTINO}?mp=erro`, 302)
  }

  return sendRedirect(event, `${DESTINO}?mp=conectado`, 302)
})
