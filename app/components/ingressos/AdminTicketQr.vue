<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue3-toastify'
import { ChatBubbleLeftRightIcon, LinkIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import { montarLinkWhatsApp } from '~/utils/share'

const props = defineProps<{
  ingressoId: string
}>()

interface QrResposta {
  codigo: string
  status: string
  svg: string | null
}

interface ShareResposta {
  shareUrl: string
  telefone: string | null
  participanteNome: string
  eventoNome: string
}

const carregando = ref(true)
const erro = ref(false)
const qr = ref<QrResposta | null>(null)
const gerandoLink = ref(false)

async function carregar() {
  carregando.value = true
  erro.value = false
  qr.value = null
  try {
    qr.value = await $fetch<QrResposta>(`/api/admin/tickets/${props.ingressoId}/qr`)
  } catch {
    erro.value = true
  } finally {
    carregando.value = false
  }
}

watch(() => props.ingressoId, carregar, { immediate: true })

const aviso = computed(() => {
  switch (qr.value?.status) {
    case 'UTILIZADO':
      return 'Ingresso já utilizado: a entrada já foi registrada.'
    case 'RESERVADO':
      return 'Disponível após a confirmação do pagamento.'
    case 'EXPIRADO':
      return 'Este ingresso expirou junto com a reserva.'
    case 'CANCELADO':
      return 'Este ingresso foi cancelado e não pode ser utilizado.'
    default:
      return 'QR Code indisponível para este ingresso.'
  }
})

async function gerarLink(): Promise<ShareResposta> {
  return await $fetch<ShareResposta>(`/api/admin/tickets/${props.ingressoId}/share`, {
    method: 'POST'
  })
}

async function enviarWhatsApp() {
  if (gerandoLink.value) return
  gerandoLink.value = true
  // Abre a aba ja no clique (senao o navegador bloqueia o pop-up).
  const janela = typeof window !== 'undefined' ? window.open('', '_blank') : null
  try {
    const dados = await gerarLink()
    const link = montarLinkWhatsApp({
      url: dados.shareUrl,
      eventoNome: dados.eventoNome,
      participanteNome: dados.participanteNome,
      telefone: dados.telefone
    })
    if (janela) janela.location.href = link
    else window.location.href = link
  } catch {
    janela?.close()
    toast.error('Não foi possível gerar o link do ingresso.')
  } finally {
    gerandoLink.value = false
  }
}

async function copiarLink() {
  if (gerandoLink.value) return
  gerandoLink.value = true
  try {
    const dados = await gerarLink()
    await navigator.clipboard.writeText(dados.shareUrl)
    toast.success('Link do ingresso copiado.')
  } catch {
    toast.error('Não foi possível copiar o link do ingresso.')
  } finally {
    gerandoLink.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div v-if="carregando" class="mx-auto aspect-square w-full max-w-[280px] animate-pulse rounded-xl bg-zinc-800" />

    <p
      v-else-if="erro"
      class="rounded-xl border border-red-500/40 bg-red-500/5 p-4 text-center text-sm text-zinc-300"
    >
      Não foi possível carregar o QR Code.
      <button type="button" class="ml-1 cursor-pointer font-semibold text-amber-400 underline" @click="carregar">
        Tentar de novo
      </button>
    </p>

    <template v-else-if="qr?.svg">
      <!-- SVG gerado no servidor pela biblioteca qrcode (conteudo confiavel). -->
      <div
        class="mx-auto w-full max-w-[280px] rounded-xl bg-white p-3 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        role="img"
        :aria-label="`QR Code do ingresso ${qr.codigo}`"
        v-html="qr.svg"
      />
      <p class="text-center text-sm font-semibold text-white">{{ qr.codigo }}</p>
      <p class="text-center text-xs text-zinc-400">
        Este é o QR Code real, o mesmo que a portaria lê na entrada.
      </p>

      <div class="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white transition-colors duration-150 hover:bg-green-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400/50 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="gerandoLink"
          @click="enviarWhatsApp"
        >
          <ChatBubbleLeftRightIcon class="h-4 w-4" />
          Enviar pelo WhatsApp
        </button>
        <AppButton variant="ghost" :disabled="gerandoLink" @click="copiarLink">
          <LinkIcon class="h-4 w-4" />
          Copiar link
        </AppButton>
      </div>
    </template>

    <div
      v-else
      class="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-center"
    >
      <p class="text-sm font-semibold text-zinc-100">QR indisponível</p>
      <p class="mt-1 text-xs text-zinc-400">{{ aviso }}</p>
    </div>
  </div>
</template>
