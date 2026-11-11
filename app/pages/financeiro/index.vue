<script setup lang="ts">
import CaixaPagina from '~/components/financeiro/caixa/CaixaPagina.vue'

definePageMeta({
  title: 'Financeiro',
  description: 'O caixa da galeria: contas, entradas, saídas e transferências.',
  layout: 'admin-layout',
  sidebarActive: 'Financeiro',
  middleware: ['admin-auth']
})
</script>

<template>
  <CaixaPagina />
</template>
