/**
 * Verificacao rapida pelo navegador: diz se o webhook esta no ar e se as
 * variaveis do Mercado Pago existem no servidor (sem revelar os valores).
 */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  return {
    webhook: 'no ar',
    segredoConfigurado: !!config.mercadoPagoWebhookSecret,
    tokenConfigurado: !!config.mercadoPagoAccessToken
  }
})
