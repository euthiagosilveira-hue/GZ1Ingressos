// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  modules: ['@nuxtjs/supabase', '@nuxtjs/tailwindcss'],
  supabase: {
    // Sem tela /login ainda: não redirecionar usuários não autenticados.
    redirect: false,
    // Types do banco serão gerados depois que o schema existir.
    types: false
  }
})
