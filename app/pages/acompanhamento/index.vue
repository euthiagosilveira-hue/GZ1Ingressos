<script setup lang="ts">
import { onMounted, ref } from 'vue'

import EventStatusBadge from '~/components/eventos/EventStatusBadge.vue'
import { listarEventosAcompanhamento } from '~/services/acompanhamento/eventos'
import type { EventoAcompanhamentoItem } from '~/types/acompanhamento'
import type { EventStatus } from '~/types/evento'
import { formatDataHora, formatMoeda } from '~/utils/format'

definePageMeta({
  layout: 'acompanhamento-layout',
  middleware: ['acompanhamento-auth']
})

useSeoMeta({ title: 'Meus eventos | GZ1 Ingresso' })

const eventos = ref<EventoAcompanhamentoItem[]>([])
const carregando = ref(true)
const erro = ref('')

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    eventos.value = await listarEventosAcompanhamento()
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar seus eventos.'
  } finally {
    carregando.value = false
  }
}

onMounted(() => void carregar())
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Meus eventos</h1>
      <p class="mt-1 text-sm text-zinc-400">Acompanhe as vendas dos eventos em que você foi incluído.</p>
    </div>

    <div v-if="carregando" class="space-y-3" aria-busy="true">
      <div v-for="n in 3" :key="n" class="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <div v-else-if="erro" role="alert" class="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center">
      <p class="text-sm font-semibold text-red-300">{{ erro }}</p>
      <button type="button" class="text-xs font-semibold uppercase tracking-wide text-amber-400" @click="carregar">
        Tentar novamente
      </button>
    </div>

    <p
      v-else-if="eventos.length === 0"
      class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-400"
    >
      Você ainda não está em nenhum evento. Quando a galeria incluir você, ele aparece aqui.
    </p>

    <ul v-else class="space-y-3">
      <li v-for="evento in eventos" :key="evento.eventoId">
        <NuxtLink
          :to="`/acompanhamento/eventos/${evento.eventoId}`"
          class="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-amber-400/50"
        >
          <img
            v-if="evento.imagemUrl"
            :src="evento.imagemUrl"
            alt=""
            class="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate font-semibold text-white">{{ evento.nome }}</p>
              <EventStatusBadge :status="evento.status as EventStatus" />
            </div>
            <p class="text-sm text-zinc-400">{{ formatDataHora(evento.inicioEm) }}</p>
            <p class="text-sm text-zinc-300">
              {{ evento.ingressos }} {{ evento.ingressos === 1 ? 'ingresso vendido' : 'ingressos vendidos' }}
              · <span class="font-semibold text-amber-300">{{ formatMoeda(evento.valorTotal) }}</span>
            </p>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
