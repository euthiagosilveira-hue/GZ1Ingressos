<script setup lang="ts">
import { computed } from 'vue'
import { toast } from 'vue3-toastify'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'
import { eventosMock } from '~/data/eventos'
import { formatDataHora } from '~/utils/format'
import type { OrderDetail } from '~/types/pedido'

const props = defineProps<{
  pedido: OrderDetail
}>()

const evento = computed(
  () => eventosMock.find((item) => item.id === props.pedido.eventoId) ?? null
)

function verEvento() {
  if (!evento.value) {
    toast.info('Evento não disponível nos mocks.')
    return
  }
  navigateTo(`/eventos/${evento.value.id}/lotes`)
}
</script>

<template>
  <BaseCard class="space-y-4">
    <h2 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">Evento</h2>

    <dl class="space-y-3">
      <div>
        <dt class="text-xs text-zinc-500">Nome</dt>
        <dd class="text-sm text-zinc-200">{{ props.pedido.eventoNome }}</dd>
      </div>
      <div v-if="evento">
        <dt class="text-xs text-zinc-500">Data e hora</dt>
        <dd class="text-sm text-zinc-200">{{ formatDataHora(evento.inicioEm) }}</dd>
      </div>
      <div v-if="evento">
        <dt class="text-xs text-zinc-500">Local</dt>
        <dd class="text-sm text-zinc-200">{{ evento.local }}</dd>
      </div>
      <div v-if="props.pedido.loteNome">
        <dt class="text-xs text-zinc-500">Lote</dt>
        <dd class="text-sm text-zinc-200">{{ props.pedido.loteNome }}</dd>
      </div>
    </dl>

    <AppButton variant="outline" size="sm" @click="verEvento">Ver evento</AppButton>
  </BaseCard>
</template>
