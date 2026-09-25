<script setup lang="ts">
import TicketStatusBadge from '~/components/ingressos/TicketStatusBadge.vue'
import { formatDataHoraCompleta } from '~/utils/format'
import type { GateValidationResultData } from '~/types/portaria'

const props = defineProps<{
  resultado: GateValidationResultData
}>()
</script>

<template>
  <div class="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
    <dl class="space-y-2 text-sm">
      <div class="flex items-start justify-between gap-3">
        <dt class="text-zinc-500">Participante</dt>
        <dd class="text-right font-medium text-zinc-100">
          {{ props.resultado.ingresso?.participanteNome ?? '—' }}
        </dd>
      </div>
      <div class="flex items-start justify-between gap-3">
        <dt class="text-zinc-500">Código</dt>
        <dd class="break-all text-right text-zinc-200">
          {{ props.resultado.ingresso?.codigo ?? '—' }}
        </dd>
      </div>
      <div class="flex items-center justify-between gap-3">
        <dt class="text-zinc-500">Status</dt>
        <dd>
          <TicketStatusBadge v-if="props.resultado.ingresso" :status="props.resultado.ingresso.status" />
        </dd>
      </div>
      <div class="flex items-start justify-between gap-3">
        <dt class="text-zinc-500">Evento</dt>
        <dd class="text-right text-zinc-200">
          {{ props.resultado.ingresso?.eventoNome ?? '—' }}
        </dd>
      </div>
      <div class="flex items-start justify-between gap-3">
        <dt class="text-zinc-500">Lote</dt>
        <dd class="text-right text-zinc-200">
          {{ props.resultado.ingresso?.loteNome ?? 'Venda avulsa' }}
        </dd>
      </div>
      <div v-if="props.resultado.utilizadoEm" class="flex items-start justify-between gap-3">
        <dt class="text-zinc-500">Utilizado em</dt>
        <dd class="text-right text-zinc-200">
          {{ formatDataHoraCompleta(props.resultado.utilizadoEm) }}
        </dd>
      </div>
    </dl>
  </div>
</template>
