<script setup lang="ts">
import { formatHora } from '~/utils/format'
import type { GateRecentEntry } from '~/types/portaria'

const props = defineProps<{
  entrada: GateRecentEntry
}>()
</script>

<template>
  <li class="flex items-start gap-3 border-t border-zinc-800 py-3 first:border-t-0 first:pt-0">
    <span class="w-12 shrink-0 text-sm font-semibold tabular-nums text-zinc-300">
      {{ formatHora(props.entrada.registradoEm) }}
    </span>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-zinc-100">{{ props.entrada.participanteNome }}</p>
      <p class="truncate text-xs text-zinc-500">{{ props.entrada.codigo }}</p>
    </div>
    <span
      class="shrink-0 rounded-full border border-zinc-700 bg-zinc-800/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300"
    >
      {{ props.entrada.metodo === 'QR_CODE' ? 'QR Code' : 'Nome' }}
    </span>
  </li>
</template>
