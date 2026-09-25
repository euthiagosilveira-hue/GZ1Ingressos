<script setup lang="ts">
import type { EventListItem } from '~/types/evento'

const props = withDefaults(
  defineProps<{
    evento?: EventListItem | null
    totalEntradas: number
  }>(),
  { evento: null }
)
</script>

<template>
  <header class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h1 class="text-2xl font-bold text-white">Portaria</h1>
      <p class="mt-1 text-sm text-zinc-400">
        Valide ingressos e registre entradas do evento.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <span
        v-if="props.evento"
        class="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-300"
      >
        <span class="h-2 w-2 rounded-full bg-green-400"></span>
        Portaria ativa
      </span>
      <span class="text-xs text-zinc-400">
        Entradas nesta sessão:
        <span class="font-semibold text-zinc-200">{{ props.totalEntradas }}</span>
      </span>
    </div>
  </header>
</template>
