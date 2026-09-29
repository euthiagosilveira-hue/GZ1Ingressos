<script setup lang="ts">
import GateEmptyState from '~/components/portaria/GateEmptyState.vue'
import GateEventSelector from '~/components/portaria/GateEventSelector.vue'
import GateHeader from '~/components/portaria/GateHeader.vue'
import GateModeTabs from '~/components/portaria/GateModeTabs.vue'
import GateNameSearch from '~/components/portaria/GateNameSearch.vue'
import GateQrScanner from '~/components/portaria/GateQrScanner.vue'
import GateQrSimulator from '~/components/portaria/GateQrSimulator.vue'
import GateRecentEntries from '~/components/portaria/GateRecentEntries.vue'
import GateSearchResults from '~/components/portaria/GateSearchResults.vue'
import GateValidationResult from '~/components/portaria/GateValidationResult.vue'
import { useGate } from '~/composables/useGate'
import type { EventListItem } from '~/types/evento'
import type { TicketListItem } from '~/types/ingresso'

const props = defineProps<{
  ingressos: TicketListItem[]
  eventos: EventListItem[]
}>()

const {
  eventosOperacionais,
  eventoId,
  eventoAtual,
  modo,
  busca,
  resultado,
  entradasRecentes,
  resultadosBusca,
  opcoesSimulacao,
  selecionarEvento,
  definirModo,
  atualizarBusca,
  validarPorId,
  simularLeitura,
  registrarEntrada,
  validarProximo
} = useGate(props.ingressos, props.eventos)
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-5">
    <GateHeader :evento="eventoAtual" :total-entradas="entradasRecentes.length" />

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

        <GateValidationResult
          v-if="resultado"
          :resultado="resultado"
          @registrar="registrarEntrada"
          @proximo="validarProximo"
        />

        <template v-else-if="modo === 'QR'">
          <GateQrScanner :evento-id="eventoId" />
          <GateQrSimulator :opcoes="opcoesSimulacao" @simular="simularLeitura" />
        </template>

        <template v-else>
          <p
            class="rounded-xl border border-dashed border-zinc-700 bg-zinc-950 p-3 text-center text-xs text-zinc-500"
          >
            Busca por nome em simulação — integração real pendente.
          </p>
          <GateNameSearch :model-value="busca" @update:model-value="atualizarBusca" />
          <GateSearchResults
            :resultados="resultadosBusca"
            :busca="busca"
            @validar="validarPorId"
          />
        </template>
      </div>

      <GateRecentEntries :entradas="entradasRecentes" />
    </div>
  </div>
</template>
