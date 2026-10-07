<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  ArrowLeftIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon
} from '@heroicons/vue/24/outline'

import { AuthError, useOperatorAuth } from '~/composables/useOperatorAuth'
import { mensagemLoginErro, sanitizarRedirect } from '~/utils/auth'

definePageMeta({
  layout: false
})

useSeoMeta({
  title: 'Entrar | GZ1 Ingresso',
  description: 'Acesso restrito ao painel da Galeria Zero 1.'
})

const route = useRoute()
const { login, carregando, logout } = useOperatorAuth()

const form = reactive({ email: '', senha: '' })
const erro = ref('')
const mostrarSenha = ref(false)
const fotoOk = ref(true)

/**
 * Foto real da fachada (colocada em public/login-fachada.jpg).
 * Referenciada dinamicamente para nao quebrar o build enquanto o arquivo
 * nao estiver presente; ha fallback grafico se a imagem faltar.
 */
const fotoSrc = '/login-fachada.jpg'

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
    const destino = sanitizarRedirect(
      typeof route.query.redirect === 'string' ? route.query.redirect : null
    )
    // Honra o redirect apenas se for interno e permitido ao perfil.
    if (destino && (perfil.perfil === 'ADMINISTRADOR' || destino.startsWith('/portaria'))) {
      await navigateTo(destino)
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
  <main
    class="relative flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden bg-zinc-950 text-white"
    style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)"
  >
    <!-- Foto real da fachada (background full-bleed) -->
    <div class="absolute inset-0" aria-hidden="true">
      <div
        class="absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_10%,rgba(251,191,36,0.10),transparent_55%)]"
      />
      <img
        v-if="fotoOk"
        :src="fotoSrc"
        alt=""
        loading="eager"
        decoding="async"
        class="h-full w-full object-cover object-[50%_32%]"
        @error="fotoOk = false"
      />
      <div class="absolute inset-0 bg-black/65 lg:bg-black/45" />
      <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/20" />
    </div>

    <!-- Conteudo: 2 colunas no desktop; coluna unica (card sobre a foto) no mobile -->
    <div class="relative z-10 grid w-full lg:min-h-screen lg:grid-cols-[58%_42%]">
      <div class="hidden lg:block" />

      <div
        class="flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8 lg:min-h-screen lg:bg-zinc-950 lg:px-12 lg:py-14"
      >
        <section
          class="w-full max-w-sm rounded-3xl border border-amber-400/20 bg-zinc-950/80 p-7 shadow-2xl shadow-black/60 backdrop-blur-md sm:p-9"
        >
          <header class="space-y-3 text-center">
            <img
              src="/Logo horizontal.png"
              alt="Galeria Zero 1"
              class="mx-auto h-11 w-auto"
            />
            <div class="space-y-1">
              <h1 class="text-2xl font-bold text-white">Entrar</h1>
              <p class="text-sm text-zinc-400">Acesse o painel da Galeria Zero 1</p>
            </div>
          </header>

          <p
            v-if="erroQuery || erro"
            role="alert"
            class="mt-6 flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300"
          >
            <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0" />
            <span>{{ erro || erroQuery }}</span>
          </p>

          <form class="mt-6 space-y-4" novalidate @submit.prevent="entrar">
            <div class="space-y-1.5">
              <label for="email" class="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                E-mail
              </label>
              <div class="relative">
                <EnvelopeIcon
                  class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="email"
                  v-model="form.email"
                  type="email"
                  name="email"
                  autocomplete="email"
                  required
                  class="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <label for="senha" class="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Senha
              </label>
              <div class="relative">
                <LockClosedIcon
                  class="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500"
                />
                <input
                  id="senha"
                  v-model="form.senha"
                  :type="mostrarSenha ? 'text' : 'password'"
                  name="password"
                  autocomplete="current-password"
                  required
                  class="w-full rounded-xl border border-zinc-700 bg-zinc-900/80 py-3 pl-11 pr-11 text-sm text-zinc-100 placeholder:text-zinc-600 transition-colors focus:border-amber-400/70 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  class="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-zinc-500 transition-colors hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                  :aria-label="mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'"
                  :aria-pressed="mostrarSenha"
                  @click="mostrarSenha = !mostrarSenha"
                >
                  <EyeSlashIcon v-if="mostrarSenha" class="h-5 w-5" />
                  <EyeIcon v-else class="h-5 w-5" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="carregando"
              class="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-zinc-950 transition-colors duration-150 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:pointer-events-none disabled:opacity-60"
            >
              <span
                v-if="carregando"
                class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-950/40 border-t-zinc-950"
              />
              {{ carregando ? 'Entrando...' : 'Entrar' }}
            </button>
          </form>

          <NuxtLink
            to="/eventos-publicos"
            class="mt-6 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:text-amber-300"
          >
            <ArrowLeftIcon class="h-4 w-4" />
            Voltar ao site
          </NuxtLink>
        </section>
      </div>
    </div>
  </main>
</template>
