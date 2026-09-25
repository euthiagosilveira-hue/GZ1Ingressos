<script setup lang="ts">
import { computed } from 'vue'

import TicketDetails from '~/components/ingressos/TicketDetails.vue'
import TicketNotFound from '~/components/ingressos/TicketNotFound.vue'
import { buscarIngressoDetalhe } from '~/data/ingressoDetalhes'

definePageMeta({
  title: 'Detalhe do ingresso',
  description: 'Consulte os dados do ingresso.',
  layout: 'admin-layout',
  sidebarActive: 'Ingressos'
})

const route = useRoute()
const ingresso = computed(() => buscarIngressoDetalhe(String(route.params.id)))
</script>

<template>
  <TicketDetails v-if="ingresso" :ingresso="ingresso" />
  <TicketNotFound v-else />
</template>
