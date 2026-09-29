// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/supabase', '@nuxtjs/tailwindcss'],
  runtimeConfig: {
    // Somente backend. Nunca expor em public.
    mercadoPagoAccessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '',
    mercadoPagoWebhookSecret: process.env.MERCADO_PAGO_WEBHOOK_SECRET || '',
    // Somente testes: auto-aprovacao Pix (first_name=APRO). Default false.
    mercadoPagoTestAutoApprovePix: process.env.MERCADO_PAGO_TEST_AUTO_APPROVE_PIX || 'false'
  },
  supabase: {
    // Sem tela /login ainda: não redirecionar usuários não autenticados.
    redirect: false,
    // Types do banco serão gerados depois que o schema existir.
    types: false
  }
})
