<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckIcon, DocumentDuplicateIcon, GlobeAltIcon } from '@heroicons/vue/24/outline'
import { toast } from 'vue3-toastify'

import { urlPublicaEvento } from '~/utils/dashboard'

/** Link da pagina publica com todos os eventos a venda (/eventos-publicos), com copiar e WhatsApp. */
const config = useRuntimeConfig()
const origem = ref('')
onMounted(() => {
  origem.value = window.location.origin
})

const url = computed(() =>
  config.public.siteUrl || origem.value
    ? urlPublicaEvento(config.public.siteUrl as string, origem.value, '/eventos-publicos')
    : ''
)

const linkWhatsapp = computed(() =>
  url.value ? `https://wa.me/?text=${encodeURIComponent(`Confira nossos eventos e garanta seu ingresso: ${url.value}`)}` : ''
)

const copiado = ref(false)

async function copiar() {
  if (!url.value) return
  try {
    await navigator.clipboard.writeText(url.value)
    copiado.value = true
    toast.success('Link da página de eventos copiado!')
    setTimeout(() => {
      copiado.value = false
    }, 2000)
  } catch {
    toast.error('Não foi possível copiar. Selecione o link e copie manualmente.')
  }
}
</script>

<template>
  <div
    v-if="url"
    class="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:flex-row sm:items-center sm:gap-3"
  >
    <p class="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Link da página de eventos</p>
    <div class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 pl-3 pr-1.5">
      <GlobeAltIcon class="h-4 w-4 shrink-0 text-zinc-500" />
      <a
        :href="url"
        target="_blank"
        rel="noopener"
        class="min-w-0 flex-1 truncate text-xs text-zinc-300 hover:text-amber-400"
        :title="url"
      >
        {{ url }}
      </a>
      <button
        type="button"
        class="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/10"
        :aria-label="copiado ? 'Link copiado' : 'Copiar link da página de eventos'"
        @click="copiar"
      >
        <CheckIcon v-if="copiado" class="h-4 w-4" />
        <DocumentDuplicateIcon v-else class="h-4 w-4" />
        {{ copiado ? 'Copiado' : 'Copiar' }}
      </button>
      <a
        :href="linkWhatsapp"
        target="_blank"
        rel="noopener"
        class="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-400/10"
      >
        WhatsApp
      </a>
    </div>
  </div>
</template>
