<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  LinkIcon,
  MapPinIcon
} from '@heroicons/vue/24/outline'
import { toast } from 'vue3-toastify'

import AppButton from '~/components/AppButton.vue'
import type { TodayEvent } from '~/types/dashboard'
import { urlPublicaEvento } from '~/utils/dashboard'

const props = defineProps<{
  event: TodayEvent
  /** Dashboard filtrado por este evento ("Ver evento" ja clicado). */
  filtrado?: boolean
}>()

const config = useRuntimeConfig()
// Origem so existe no navegador; evita divergencia SSR x cliente.
const origem = ref('')
onMounted(() => {
  origem.value = window.location.origin
})

/** Link publico da pagina de venda, para divulgar. */
const urlPublica = computed(() =>
  config.public.siteUrl || origem.value
    ? urlPublicaEvento(config.public.siteUrl as string, origem.value, props.event.href)
    : ''
)

const copiado = ref(false)

async function copiarUrl() {
  const url = urlPublica.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    copiado.value = true
    toast.success('Link do evento copiado!')
    setTimeout(() => {
      copiado.value = false
    }, 2000)
  } catch {
    toast.error('Não foi possível copiar. Selecione o link e copie manualmente.')
  }
}

const imagemOk = ref(true)

watch(
  () => props.event.imageUrl,
  () => {
    imagemOk.value = true
  }
)

/** Capa real apenas quando ha imagem valida e ela nao falhou no carregamento. */
const exibirCapa = computed(() => Boolean(props.event.imageUrl) && imagemOk.value)
</script>

<template>
  <BaseCard :padded="false" class="flex h-full flex-col p-5 sm:p-6">
    <h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">
      {{ props.filtrado ? 'Evento selecionado' : 'Próximo evento' }}
    </h3>

    <div v-if="props.event.hasEvent" class="mt-5 flex flex-1 flex-col gap-5 sm:flex-row">
      <!-- Capa real do evento; sem imagem valida cai no poster de data (fallback) -->
      <div
        class="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 sm:aspect-[3/4] sm:w-[38%] sm:max-w-[15rem]"
      >
        <template v-if="exibirCapa">
          <img
            :src="props.event.imageUrl as string"
            :alt="props.event.title"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-cover object-center"
            @error="imagemOk = false"
          />
          <!-- Overlay discreto: integra a capa sem cobrir info (sem textos aqui) -->
          <div
            class="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent"
            aria-hidden="true"
          ></div>
        </template>

        <template v-else>
          <div class="absolute inset-0 bg-gradient-to-b from-zinc-700 via-zinc-900 to-black"></div>
          <div
            class="absolute inset-0"
            style="background: radial-gradient(circle at 50% 22%, rgba(251, 191, 36, 0.22), transparent 64%)"
          ></div>
          <div class="relative flex h-full flex-col items-center justify-center px-3 text-center">
            <p class="text-xs font-semibold tracking-[0.3em] text-amber-400">
              {{ props.event.poster.weekday }}
            </p>
            <p class="text-5xl font-black leading-none text-white">
              {{ props.event.poster.day }}
            </p>
            <p class="mt-1 text-xs tracking-[0.3em] text-zinc-400">
              {{ props.event.poster.month }}
            </p>
            <div class="mt-4 w-full border-t border-amber-400/30 pt-3">
              <p class="text-[10px] tracking-[0.3em] text-zinc-500">
                {{ props.event.poster.label }}
              </p>
              <p class="text-sm font-bold tracking-wide text-white">
                {{ props.event.poster.name }}
              </p>
            </div>
          </div>
        </template>
      </div>

      <div class="flex min-w-0 flex-1 flex-col">
        <span
          class="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold tracking-wide text-zinc-950"
        >
          <span class="h-1.5 w-1.5 rounded-full bg-red-600"></span>
          {{ props.event.badge }}
        </span>

        <p class="mt-3 text-lg font-bold text-white sm:text-xl">{{ props.event.title }}</p>

        <div class="mt-5 space-y-2.5 text-sm text-zinc-400">
          <div class="flex items-center gap-2.5">
            <CalendarDaysIcon class="h-[18px] w-[18px] shrink-0 text-zinc-500" />
            <span class="truncate">{{ props.event.date }}</span>
          </div>
          <div class="flex items-center gap-2.5">
            <ClockIcon class="h-[18px] w-[18px] shrink-0 text-zinc-500" />
            <span>{{ props.event.time }}</span>
          </div>
          <div class="flex items-center gap-2.5">
            <MapPinIcon class="h-[18px] w-[18px] shrink-0 text-zinc-500" />
            <span class="truncate">{{ props.event.venue }}</span>
          </div>
        </div>

        <!-- Link publico da pagina de venda + copiar -->
        <div v-if="urlPublica" class="mt-5">
          <p class="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Link de venda
          </p>
          <div class="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 pl-3 pr-1.5">
            <LinkIcon class="h-4 w-4 shrink-0 text-zinc-500" />
            <a
              :href="urlPublica"
              target="_blank"
              rel="noopener"
              class="min-w-0 flex-1 truncate text-xs text-zinc-300 hover:text-amber-400"
              :title="urlPublica"
            >
              {{ urlPublica }}
            </a>
            <button
              type="button"
              class="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
              :aria-label="copiado ? 'Link copiado' : 'Copiar link do evento'"
              @click="copiarUrl"
            >
              <CheckIcon v-if="copiado" class="h-4 w-4" />
              <DocumentDuplicateIcon v-else class="h-4 w-4" />
              {{ copiado ? 'Copiado' : 'Copiar' }}
            </button>
          </div>
        </div>

        <div class="mt-auto pt-6">
          <!-- "Ver evento" filtra o dashboard por este evento; filtrado, volta para todos -->
          <AppButton
            v-if="props.filtrado"
            to="/"
            variant="outline"
            size="md"
            class="w-fit"
          >
            Ver todos os eventos
          </AppButton>
          <AppButton
            v-else-if="props.event.eventoId"
            :to="`/?evento=${props.event.eventoId}`"
            variant="outlineAccent"
            size="md"
            class="w-fit"
          >
            Ver evento
          </AppButton>
        </div>
      </div>
    </div>

    <div v-else class="mt-5 flex flex-1 items-center justify-center">
      <p class="text-center text-sm text-zinc-500">{{ props.event.title }}</p>
    </div>
  </BaseCard>
</template>
