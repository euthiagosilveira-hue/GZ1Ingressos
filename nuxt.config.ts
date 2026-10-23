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
    mercadoPagoTestAutoApprovePix: process.env.MERCADO_PAGO_TEST_AUTO_APPROVE_PIX || 'false',
    // Notificacoes push de venda (Web Push/VAPID). Chave privada somente backend.
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || '',
    public: {
      // Chave publica VAPID (par da VAPID_PRIVATE_KEY). Vazia = push desativado.
      vapidPublicKey: process.env.NUXT_PUBLIC_VAPID_PUBLIC_KEY || '',
      // URL publica canonica da aplicacao (usada em redirects de Auth, ex.: convite).
      // Producao: https://gz-1-ingressos.vercel.app
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || ''
    }
  },
  supabase: {
    // Sem tela /login ainda: não redirecionar usuários não autenticados.
    redirect: false,
    // Types do banco serão gerados depois que o schema existir.
    types: false
  }
})
