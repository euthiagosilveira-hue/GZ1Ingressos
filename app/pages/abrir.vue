<script setup lang="ts">
import { useOperatorAuth } from '~/composables/useOperatorAuth'

/**
 * Pagina inicial do aplicativo (PWA / APK Android, start_url do manifest).
 * Leva cada usuario para a area certa: portaria -> /portaria,
 * administrador -> /, sem sessao -> /login.
 * Evita abrir direto em "/", que desloga quem e da portaria.
 */
definePageMeta({
  layout: false
})

useSeoMeta({ title: 'GZ1 Ingressos' })

const supabase = useSupabaseClient()
const { carregarOperador } = useOperatorAuth()

onMounted(async () => {
  let uid: string | null = null
  try {
    const { data } = await supabase.auth.getSession()
    uid = data.session?.user?.id ?? null
  } catch {
    uid = null
  }
  if (!uid) return navigateTo('/login', { replace: true })

  try {
    const perfil = await carregarOperador(uid)
    if (perfil?.ativo && perfil.perfil === 'PORTARIA') {
      return navigateTo('/portaria', { replace: true })
    }
    if (perfil?.ativo && perfil.perfil === 'ADMINISTRADOR') {
      return navigateTo('/', { replace: true })
    }
  } catch {
    // Erro transitorio: o login decide.
  }
  return navigateTo('/login', { replace: true })
})
</script>

<template>
  <main class="flex min-h-[100dvh] items-center justify-center bg-zinc-950">
    <img src="/icons/icon-192.png" alt="GZ1 Ingressos" class="h-20 w-20 animate-pulse rounded-2xl" />
  </main>
</template>
