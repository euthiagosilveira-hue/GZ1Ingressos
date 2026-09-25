<script setup lang="ts">
import TicketList from '~/components/ingressos/TicketList.vue'
import { ingressosMock } from '~/data/ingressos'

definePageMeta({
  title: 'Ingressos',
  description: 'Consulte ingressos emitidos, status e utilização nos eventos.',
  layout: 'admin-layout',
  sidebarActive: 'Ingressos'
})
</script>

<template>
  <TicketList :ingressos="ingressosMock" />
</template>
