<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import { AuthError, useOperatorAuth } from '~/composables/useOperatorAuth'
import { mensagemLoginErro } from '~/utils/auth'

definePageMeta({
  layout: false
})

useSeoMeta({
  title: 'Entrar | GZ1 Ingresso',
  description: 'Acesso restrito à portaria.'
})

const route = useRoute()
const { login, carregando, logout } = useOperatorAuth()

const form = reactive({ email: '', senha: '' })
const erro = ref('')

const erroQuery = computed(() => {
  const e = route.query.erro
  return typeof e === 'string' && e ? mensagemLoginErro(e as never) : ''
})

async function entrar() {
  erro.value = ''
  if (!form.email.trim() || !form.senha) {
    erro.value = 'Informe e-mail e senha.'
    return
  }

  try {
    const perfil = await login(form.email, form.senha)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect) {
      await navigateTo(redirect)
      return
    }
    await navigateTo(perfil.perfil === 'PORTARIA' ? '/portaria' : '/')
  } catch (e) {
    erro.value = e instanceof AuthError ? e.message : mensagemLoginErro('ERRO_TEMPORARIO')
    // Garante que uma sessao sem permissao nao permaneca ativa.
    if (e instanceof AuthError && e.code !== 'CREDENCIAIS_INVALIDAS') {
      await logout().catch(() => {})
    }
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-white">
    <section class="w-full max-w-sm space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
      <header class="space-y-3 text-center">
        <img src="/Logo horizontal.png" alt="Galeria Zero 1" class="mx-auto h-10 w-auto" />
        <h1 class="text-lg font-bold uppercase tracking-wide text-amber-400">Portaria</h1>
        <p class="text-sm text-zinc-400">Acesso restrito à equipe.</p>
      </header>

      <p
        v-if="erroQuery || erro"
        role="alert"
        class="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300"
      >
        <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0" />
        <span>{{ erro || erroQuery }}</span>
      </p>

      <form class="space-y-4" @submit.prevent="entrar">
        <div class="space-y-1.5">
          <label for="email" class="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            E-mail
          </label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            autocomplete="username"
            required
            class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            placeholder="operador@gz1.com"
          />
        </div>

        <div class="space-y-1.5">
          <label for="senha" class="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Senha
          </label>
          <input
            id="senha"
            v-model="form.senha"
            type="password"
            autocomplete="current-password"
            required
            class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            placeholder="••••••••"
          />
        </div>

        <AppButton type="submit" variant="primary" size="lg" block :disabled="carregando">
          {{ carregando ? 'Entrando...' : 'Entrar' }}
        </AppButton>
      </form>

      <NuxtLink
        to="/"
        class="block text-center text-xs font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-300"
      >
        Voltar ao site
      </NuxtLink>
    </section>
  </main>
</template>
