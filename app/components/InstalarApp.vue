<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowDownTrayIcon, DevicePhoneMobileIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseModal from '~/components/BaseModal.vue'

/**
 * Botao "Instalar app" do sidebar. Some quando o site ja esta aberto como app
 * (APK Android/TWA ou atalho na tela de inicio).
 * Android: baixa o APK. iPhone: instrucoes do Safari. Computador: prompt de
 * instalacao do Chrome/Edge quando disponivel.
 */
const emit = defineEmits<{ navigate: [] }>()

const APK_URL = '/download/gz1-ingressos.apk'

interface EventoInstalacao extends Event {
  prompt: () => Promise<void>
}

const visivel = ref(false)
const aberto = ref(false)
const plataforma = ref<'android' | 'ios' | 'outro'>('outro')
const promptInstalacao = ref<EventoInstalacao | null>(null)

function aoPodeInstalar(evento: Event) {
  evento.preventDefault()
  promptInstalacao.value = evento as EventoInstalacao
}

function jaInstalado() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  )
}

onMounted(() => {
  if (jaInstalado()) return
  const ua = navigator.userAgent
  if (/android/i.test(ua)) plataforma.value = 'android'
  else if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
    plataforma.value = 'ios'
  }
  window.addEventListener('beforeinstallprompt', aoPodeInstalar)
  visivel.value = true
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', aoPodeInstalar)
})

function abrir() {
  aberto.value = true
}

async function instalarNoComputador() {
  if (!promptInstalacao.value) return
  await promptInstalacao.value.prompt()
  promptInstalacao.value = null
  aberto.value = false
}

function aoBaixar() {
  aberto.value = false
  emit('navigate')
}
</script>

<template>
  <button
    v-if="visivel"
    type="button"
    class="group flex w-full cursor-pointer items-center gap-3.5 rounded-lg px-4 py-3 text-sm text-zinc-400 transition-colors duration-150 hover:bg-zinc-800 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
    @click="abrir"
  >
    <DevicePhoneMobileIcon class="h-[22px] w-[22px]" />
    <span class="flex-1 text-left">Instalar app</span>
  </button>

  <BaseModal
    :open="aberto"
    title="Instalar app"
    subtitle="Acesse o GZ1 Ingressos direto da tela inicial do celular."
    @close="aberto = false"
  >
    <div class="space-y-6 text-sm text-zinc-300">
      <section v-if="plataforma !== 'ios'" class="space-y-3">
        <h3 class="font-semibold text-white">Android</h3>
        <ol class="list-decimal space-y-1 pl-5 text-zinc-400">
          <li>Toque em <strong class="text-zinc-200">Baixar app</strong>.</li>
          <li>Abra o arquivo baixado.</li>
          <li>Se o celular pedir, permita instalar apps desta fonte.</li>
        </ol>
        <a
          :href="APK_URL"
          download
          class="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 py-3 text-sm font-semibold uppercase tracking-wide text-zinc-950 transition-colors duration-150 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
          @click="aoBaixar"
        >
          <ArrowDownTrayIcon class="h-5 w-5" />
          Baixar app
        </a>
      </section>

      <section v-if="plataforma !== 'android'" class="space-y-3">
        <h3 class="font-semibold text-white">iPhone</h3>
        <ol class="list-decimal space-y-1 pl-5 text-zinc-400">
          <li>Abra este site no <strong class="text-zinc-200">Safari</strong>.</li>
          <li>Toque no botão <strong class="text-zinc-200">Compartilhar</strong>.</li>
          <li>Escolha <strong class="text-zinc-200">Adicionar à Tela de Início</strong>.</li>
        </ol>
      </section>

      <section v-if="plataforma === 'outro'" class="space-y-3">
        <h3 class="font-semibold text-white">Computador</h3>
        <AppButton v-if="promptInstalacao" variant="outline" block @click="instalarNoComputador">
          Instalar neste computador
        </AppButton>
        <p v-else class="text-zinc-400">
          No Chrome ou Edge, use o ícone de instalar na barra de endereço.
        </p>
      </section>
    </div>
  </BaseModal>
</template>
