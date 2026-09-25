<script setup lang="ts">
import OrderList from '~/components/pedidos/OrderList.vue'
import { pedidosMock } from '~/data/pedidos'

definePageMeta({
  title: 'Pedidos',
  description: 'Acompanhe reservas, pagamentos e vendas dos eventos.',
  layout: 'admin-layout',
  sidebarActive: 'Pedidos'
})
</script>

<template>
  <OrderList :pedidos="pedidosMock" />
</template>
