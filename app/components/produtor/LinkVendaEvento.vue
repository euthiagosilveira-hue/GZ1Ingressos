<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CheckIcon, DocumentDuplicateIcon, LinkIcon } from '@heroicons/vue/24/outline'
import { toast } from 'vue3-toastify'

import { urlPublicaEvento } from '~/utils/dashboard'

/** Link publico da pagina de venda do evento, com copiar e WhatsApp (area do produtor). */
const props = defineProps<{ slug: string; nome?: string }>()

const config = useRuntimeConfig()
const origem = ref('')
onMounted(() => {
  origem.value = window.location.origin
})

const url = computed(() =>
  props.slug && (config.public.siteUrl || origem.value)
    ? urlPublicaEvento(config.public.siteUrl as string, origem.value, `/eventos/${props.slug}`)
    : ''
)

const linkWhatsapp = computed(() => {
  if (!url.value) return ''
  const texto = props.nome ? `Ingressos para ${props.nome}: ${url.value}` : url.value
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
})

const copiado = ref(false)

async function copiar() {
  if (!url.value) return
  try {
    await navigator.clipboard.writeText(url.value)
    copiado.value = true
    toast.success('Link de venda copiado!')
    setTimeout(() => {
      copiado.value = false
    }, 2000)
  } catch {
    toast.error('Não foi possível copiar. Selecione o link e copie manualmente.')
  }
}
</script>

<template>
  <div v-if="url">
    <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Link de venda</p>
    <div class="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 pl-3 pr-1.5">
      <LinkIcon class="h-4 w-4 shrink-0 text-zinc-500" />
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
        :aria-label="copiado ? 'Link copiado' : 'Copiar link de venda'"
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
