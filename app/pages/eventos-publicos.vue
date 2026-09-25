<script setup lang="ts">
import { CalendarDaysIcon, MapPinIcon } from '@heroicons/vue/24/outline'

import PublicEventStatusBadge from '~/components/public/eventos/PublicEventStatusBadge.vue'
import { listarEventosPublicos } from '~/data/eventosPublicos'
import { formatData, formatHora, formatMoeda } from '~/utils/format'

definePageMeta({
  layout: 'public-layout'
})

useSeoMeta({
  title: 'Eventos | GZ1 Ingresso',
  description: 'Confira a agenda de eventos da Galeria Zero 1.'
})

const eventos = listarEventosPublicos()
</script>

<template>
  <div class="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
    <h1 class="text-3xl font-bold text-white">Eventos</h1>
    <p class="mt-2 text-sm text-zinc-400">Confira a agenda e garanta seu ingresso.</p>

    <div class="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="evento in eventos"
        :key="evento.slug"
        :to="`/eventos/${evento.slug}`"
        class="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition-colors duration-200 hover:border-amber-400/40"
      >
        <div class="relative aspect-video w-full overflow-hidden bg-zinc-950">
          <img
            v-if="evento.imagemUrl"
            :src="evento.imagemUrl"
            :alt="evento.nome"
            class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
          <div
            v-else
            class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 via-zinc-900 to-black"
          >
            <CalendarDaysIcon class="h-8 w-8 text-amber-400/80" />
          </div>
          <div class="absolute left-3 top-3">
            <PublicEventStatusBadge :status="evento.status" />
          </div>
        </div>

        <div class="space-y-2 p-4">
          <h2 class="truncate text-lg font-semibold text-white group-hover:text-amber-400">
            {{ evento.nome }}
          </h2>
          <p class="text-sm text-zinc-400">
            {{ formatData(evento.inicioEm) }} • {{ formatHora(evento.inicioEm) }}
          </p>
          <p class="flex items-center gap-2 text-sm text-zinc-500">
            <MapPinIcon class="h-4 w-4 shrink-0" />
            <span class="truncate">{{ evento.local }}</span>
          </p>
          <p v-if="evento.preco !== null" class="pt-1 text-sm font-semibold text-amber-400">
            {{ formatMoeda(evento.preco) }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
