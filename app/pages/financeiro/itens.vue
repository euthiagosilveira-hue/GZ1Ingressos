<script setup lang="ts">
import ItensCompradosPagina from '~/components/financeiro/caixa/ItensCompradosPagina.vue'

definePageMeta({
  title: 'Itens comprados',
  description: 'Histórico dos produtos lidos dos comprovantes.',
  layout: 'admin-layout',
  sidebarActive: 'Financeiro',
  middleware: ['admin-auth']
})
</script>

<template>
  <ItensCompradosPagina />
</template>
