<script setup lang="ts">
import ConfiguracoesCaixaPagina from '~/components/financeiro/caixa/ConfiguracoesCaixaPagina.vue'

definePageMeta({
  title: 'Contas e categorias',
  description: 'Contas do caixa e categorias de entradas e saídas.',
  layout: 'admin-layout',
  sidebarActive: 'Financeiro',
  middleware: ['admin-auth']
})
</script>

<template>
  <ConfiguracoesCaixaPagina />
</template>
