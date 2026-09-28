<script setup lang="ts">
import { ClockIcon } from '@heroicons/vue/24/outline'

const props = defineProps<{
  texto: string
  esgotado: boolean
}>()

const emit = defineEmits<{
  atualizar: []
}>()
</script>

<template>
  <div class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
    <template v-if="!props.esgotado">
      <div class="flex items-center justify-between gap-3">
        <span class="inline-flex items-center gap-2 text-sm text-zinc-400">
          <ClockIcon class="h-4 w-4 text-amber-400" />
          Expira em
        </span>
        <span class="text-2xl font-bold tabular-nums text-amber-400">{{ props.texto }}</span>
      </div>
    </template>

    <template v-else>
      <p class="text-sm font-semibold text-amber-300">Tempo limite atingido</p>
      <p class="mt-1 text-sm text-zinc-400">
        A reserva atingiu o horário limite. Atualize o status em instantes.
      </p>
      <button
        type="button"
        class="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-amber-400/60 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-amber-400 transition-colors duration-150 hover:bg-amber-400 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        @click="emit('atualizar')"
      >
        Atualizar status
      </button>
    </template>
  </div>
</template>
