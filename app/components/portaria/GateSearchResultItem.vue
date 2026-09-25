<script setup lang="ts">
import AppButton from '~/components/AppButton.vue'
import TicketStatusBadge from '~/components/ingressos/TicketStatusBadge.vue'
import type { TicketListItem } from '~/types/ingresso'

const props = defineProps<{
  ingresso: TicketListItem
}>()

const emit = defineEmits<{
  validar: []
}>()
</script>

<template>
  <div class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-white">
          {{ props.ingresso.participanteNome }}
        </p>
        <p class="truncate text-xs text-zinc-400">{{ props.ingresso.codigo }}</p>
      </div>
      <TicketStatusBadge :status="props.ingresso.status" />
    </div>

    <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
      <span>Pedido {{ props.ingresso.pedidoCodigo }}</span>
      <span>{{ props.ingresso.loteNome ?? 'Venda avulsa' }}</span>
    </div>

    <AppButton variant="primary" block class="mt-3" @click="emit('validar')">
      Validar ingresso
    </AppButton>
  </div>
</template>
