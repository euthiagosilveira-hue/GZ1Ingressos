<script setup lang="ts">
import FluxoCaixaPagina from '~/components/financeiro/caixa/FluxoCaixaPagina.vue'

definePageMeta({
  title: 'Fluxo de caixa',
  description: 'Entradas, saídas e saldo por dia, semana ou mês.',
  layout: 'admin-layout',
  sidebarActive: 'Financeiro',
  middleware: ['admin-auth']
})
</script>

<template>
  <FluxoCaixaPagina />
</template>
