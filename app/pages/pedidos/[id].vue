<script setup lang="ts">
import { computed } from 'vue'

import OrderDetails from '~/components/pedidos/OrderDetails.vue'
import OrderNotFound from '~/components/pedidos/OrderNotFound.vue'
import { buscarPedidoDetalhe } from '~/data/pedidoDetalhes'

definePageMeta({
  title: 'Detalhe do pedido',
  description: 'Visualize todos os dados do pedido.',
  layout: 'admin-layout',
  sidebarActive: 'Pedidos'
})

const route = useRoute()
const pedido = computed(() => buscarPedidoDetalhe(String(route.params.id)))
</script>

<template>
  <OrderDetails v-if="pedido" :pedido="pedido" />
  <OrderNotFound v-else />
</template>
