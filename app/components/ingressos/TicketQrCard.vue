<script setup lang="ts">
import BaseCard from '~/components/BaseCard.vue'
import AdminTicketQr from '~/components/ingressos/AdminTicketQr.vue'
import { formatDataHoraCompleta } from '~/utils/format'
import type { TicketDetail } from '~/types/ingresso'

const props = defineProps<{
  ingresso: TicketDetail
}>()
</script>

<template>
  <BaseCard class="space-y-4">
    <h2 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">QR Code</h2>

    <AdminTicketQr :ingresso-id="props.ingresso.id" />

    <p v-if="props.ingresso.status === 'UTILIZADO' && props.ingresso.utilizadoEm" class="text-center text-xs text-green-300">
      Entrada registrada em {{ formatDataHoraCompleta(props.ingresso.utilizadoEm) }}.
    </p>
  </BaseCard>
</template>
