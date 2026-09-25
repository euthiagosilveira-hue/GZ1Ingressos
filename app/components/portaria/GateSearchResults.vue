<script setup lang="ts">
import GateSearchResultItem from '~/components/portaria/GateSearchResultItem.vue'
import type { TicketListItem } from '~/types/ingresso'

const props = defineProps<{
  resultados: TicketListItem[]
  busca: string
}>()

const emit = defineEmits<{
  validar: [id: string]
}>()
</script>

<template>
  <div>
    <div v-if="props.resultados.length > 0" class="space-y-3">
      <p class="text-xs text-zinc-500">
        {{ props.resultados.length }}
        {{ props.resultados.length === 1 ? 'participante encontrado' : 'participantes encontrados' }}
      </p>
      <GateSearchResultItem
        v-for="ingresso in props.resultados"
        :key="ingresso.id"
        :ingresso="ingresso"
        @validar="emit('validar', ingresso.id)"
      />
    </div>

    <p
      v-else-if="props.busca.trim()"
      class="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500"
    >
      Nenhum participante encontrado para este evento.
    </p>

    <p
      v-else
      class="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-8 text-center text-sm text-zinc-500"
    >
      Digite o nome para buscar participantes do evento.
    </p>
  </div>
</template>
