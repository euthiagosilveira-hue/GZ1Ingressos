<script setup lang="ts">
import { reactive, ref } from 'vue'
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import FormField from '~/components/FormField.vue'
import { PEDIDO_REDEFINICAO_ENVIADO_MSG, urlRedefinicao } from '~/utils/redefinirSenha'
import { emailValido } from '~/utils/usuarios'

definePageMeta({
  layout: false
})

useSeoMeta({
  title: 'Esqueci minha senha | GZ1 Ingresso',
  description: 'Receba um link para criar uma nova senha de acesso ao painel.'
})

const supabase = useSupabaseClient()
const config = useRuntimeConfig()

const form = reactive({ email: '' })
const erro = ref('')
const enviando = ref(false)
const enviado = ref(false)

async function enviarLink() {
  erro.value = ''
  if (!emailValido(form.email)) {
    erro.value = 'Informe um e-mail válido.'
    return
  }

  enviando.value = true
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), {
      redirectTo: urlRedefinicao(config.public.siteUrl as string, window.location.origin)
    })
    // Limite de envios: unico erro mostrado; os demais seguem neutros.
    if (error && error.status === 429) {
      erro.value = 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
      return
    }
    enviado.value = true
  } catch {
    erro.value = 'Não foi possível enviar o link agora. Tente novamente.'
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <main
    class="flex min-h-[100dvh] items-center justify-center bg-[#050505] px-4 py-10 text-white"
  >
    <section
      class="w-full max-w-md rounded-3xl border border-amber-400/20 bg-zinc-950/90 p-7 shadow-2xl shadow-black/60 backdrop-blur-md sm:p-9"
    >
      <header class="space-y-3 text-center">
        <img src="/Logo horizontal.png" alt="Galeria Zero 1" class="mx-auto h-11 w-auto" />
        <h1 class="text-2xl font-bold text-white">Esqueci minha senha</h1>
        <p class="text-sm text-zinc-400">
          Informe o seu e-mail de acesso e enviaremos um link para criar uma nova senha.
        </p>
      </header>

      <div v-if="enviado" class="mt-8 space-y-5" role="status" aria-live="polite">
        <div
          class="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-300"
        >
          <CheckCircleIcon class="mt-0.5 h-5 w-5 shrink-0" />
          <span>{{ PEDIDO_REDEFINICAO_ENVIADO_MSG }}</span>
        </div>
        <p class="text-xs text-zinc-500">
          Abra o link no mesmo navegador em que fez este pedido.
        </p>
        <AppButton variant="primary" block to="/login">Voltar ao login</AppButton>
      </div>

      <form v-else class="mt-8 space-y-5" novalidate @submit.prevent="enviarLink">
        <p
          v-if="erro"
          role="alert"
          class="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
        >
          <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0" />
          <span>{{ erro }}</span>
        </p>

        <FormField label="E-mail" required>
          <BaseInput
            v-model="form.email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="seu@email.com"
            :invalid="Boolean(erro)"
          />
        </FormField>

        <AppButton type="submit" variant="primary" block size="lg" :disabled="enviando">
          {{ enviando ? 'Enviando…' : 'Enviar link' }}
        </AppButton>

        <NuxtLink
          to="/login"
          class="flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 transition-colors hover:text-[#D9B138] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9B138]/50"
        >
          <ArrowLeftIcon class="h-4 w-4" />
          Voltar ao login
        </NuxtLink>
      </form>
    </section>
  </main>
</template>
