<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ExclamationTriangleIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import FormField from '~/components/FormField.vue'
import { useOperatorAuth } from '~/composables/useOperatorAuth'
import { codigoErroPerfil } from '~/utils/auth'
import { destinoAposConvite, extrairErroConvite, validarSenhaConvite } from '~/utils/convite'
import { LINK_REDEFINICAO_INVALIDO_MSG } from '~/utils/redefinirSenha'

definePageMeta({
  layout: false
})

useSeoMeta({
  title: 'Nova senha | GZ1 Ingresso',
  description: 'Crie uma nova senha de acesso ao painel.'
})

const supabase = useSupabaseClient()
const { carregarOperador } = useOperatorAuth()

const estado = ref<'verificando' | 'pronto' | 'erro'>('verificando')
const mensagem = ref('')
const salvando = ref(false)
const form = reactive({ senha: '', confirmacao: '' })
const erros = reactive<{ senha?: string; confirmacao?: string }>({})

const FALHA_SALVAR_MSG = 'Não foi possível salvar a nova senha. Tente novamente ou solicite um novo link.'

function falhar(texto: string) {
  mensagem.value = texto
  estado.value = 'erro'
}

onMounted(async () => {
  const search = window.location.search
  const hash = window.location.hash

  if (extrairErroConvite(search, hash)) {
    falhar(LINK_REDEFINICAO_INVALIDO_MSG)
    return
  }

  // Fluxo PKCE (?code=...)
  const code = new URLSearchParams(search.replace(/^\?/, '')).get('code')
  if (code) {
    await supabase.auth.exchangeCodeForSession(code).catch(() => {})
  }

  // Fluxo implicito (#access_token=...&type=recovery)
  const hashParams = new URLSearchParams(hash.replace(/^#/, ''))
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  if (accessToken && refreshToken) {
    await supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .catch(() => {})
  }

  // Aguarda a sessao de recuperacao ser reconhecida.
  for (let tentativa = 0; tentativa < 10; tentativa += 1) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.user?.id) {
      // Remove o codigo/token da barra de endereco.
      window.history.replaceState(null, '', window.location.pathname)
      estado.value = 'pronto'
      return
    }
    await new Promise((resolver) => setTimeout(resolver, 200))
  }

  falhar(LINK_REDEFINICAO_INVALIDO_MSG)
})

async function salvarSenha() {
  erros.senha = undefined
  erros.confirmacao = undefined
  const validacao = validarSenhaConvite(form.senha, form.confirmacao)
  if (validacao.senha) erros.senha = validacao.senha
  if (validacao.confirmacao) erros.confirmacao = validacao.confirmacao
  if (validacao.senha || validacao.confirmacao) return

  salvando.value = true
  try {
    const { data, error } = await supabase.auth.updateUser({ password: form.senha })
    if (error?.code === 'same_password') {
      erros.senha = 'A nova senha precisa ser diferente da anterior.'
      return
    }
    if (error || !data?.user) {
      falhar(FALHA_SALVAR_MSG)
      return
    }

    // So entra no painel quem tem perfil ativo e permitido.
    const perfil = await carregarOperador(data.user.id).catch(() => null)
    const codigo = codigoErroPerfil(perfil)
    if (codigo) {
      await supabase.auth.signOut().catch(() => {})
      await navigateTo(`/login?erro=${codigo}`)
      return
    }
    await navigateTo(destinoAposConvite(perfil?.perfil ?? null))
  } catch {
    falhar(FALHA_SALVAR_MSG)
  } finally {
    salvando.value = false
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
        <h1 class="text-2xl font-bold text-white">Criar nova senha</h1>
        <p class="text-sm text-zinc-400">Escolha uma nova senha para acessar o painel.</p>
      </header>

      <div
        v-if="estado === 'verificando'"
        class="mt-8 flex flex-col items-center gap-3"
        role="status"
        aria-live="polite"
      >
        <span
          class="h-8 w-8 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400"
        ></span>
        <p class="text-sm text-zinc-400">Verificando o link…</p>
      </div>

      <div v-else-if="estado === 'erro'" class="mt-8 space-y-5" role="alert">
        <div
          class="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
        >
          <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0" />
          <span>{{ mensagem }}</span>
        </div>
        <AppButton variant="primary" block to="/esqueci-senha">Pedir novo link</AppButton>
        <AppButton variant="ghost" block to="/login">Ir para o login</AppButton>
      </div>

      <form v-else class="mt-8 space-y-5" novalidate @submit.prevent="salvarSenha">
        <FormField label="Nova senha" required :error="erros.senha">
          <BaseInput
            v-model="form.senha"
            type="password"
            autocomplete="new-password"
            placeholder="Mínimo 8 caracteres"
            :invalid="Boolean(erros.senha)"
          />
        </FormField>

        <FormField label="Confirmar nova senha" required :error="erros.confirmacao">
          <BaseInput
            v-model="form.confirmacao"
            type="password"
            autocomplete="new-password"
            placeholder="Repita a senha"
            :invalid="Boolean(erros.confirmacao)"
          />
        </FormField>

        <AppButton type="submit" variant="primary" block size="lg" :disabled="salvando">
          {{ salvando ? 'Salvando…' : 'Salvar nova senha e entrar' }}
        </AppButton>
      </form>
    </section>
  </main>
</template>
