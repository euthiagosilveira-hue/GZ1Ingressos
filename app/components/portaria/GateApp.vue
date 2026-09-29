<script setup lang="ts">
import GateEmptyState from '~/components/portaria/GateEmptyState.vue'
import GateEventSelector from '~/components/portaria/GateEventSelector.vue'
import GateHeader from '~/components/portaria/GateHeader.vue'
import GateModeTabs from '~/components/portaria/GateModeTabs.vue'
import GateNameSearchPanel from '~/components/portaria/GateNameSearchPanel.vue'
import GateQrScanner from '~/components/portaria/GateQrScanner.vue'
import { useGate } from '~/composables/useGate'
import type { EventListItem } from '~/types/evento'

const props = defineProps<{
  eventos: EventListItem[]
}>()

// useGate e usado apenas para a selecao do evento (fluxo real da portaria).
const { eventosOperacionais, eventoId, eventoAtual, modo, selecionarEvento, definirModo } =
  useGate(props.eventos)
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-5">
    <GateHeader :evento="eventoAtual" />

    <GateEventSelector
      :model-value="eventoId"
      :eventos="eventosOperacionais"
      :evento="eventoAtual"
      @update:model-value="selecionarEvento"
    />

    <GateEmptyState v-if="!eventoAtual" />

    <div v-else class="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div class="space-y-5">
        <GateModeTabs :model-value="modo" @update:model-value="definirModo" />

        <GateQrScanner v-if="modo === 'QR'" :evento-id="eventoId" />
        <GateNameSearchPanel v-else :evento-id="eventoId" />
      </div>
    </div>
  </div>
</template>
