<script setup lang="ts">
import ReposicaoPagina from '~/components/financeiro/reposicao/ReposicaoPagina.vue'

definePageMeta({
  title: 'Reposição',
  description: 'Produtos e pedido semanal de reposição de estoque.',
  layout: 'admin-layout',
  sidebarActive: 'Financeiro',
  middleware: ['admin-auth']
})
</script>

<template>
  <ReposicaoPagina />
</template>
