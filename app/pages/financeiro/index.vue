<script setup lang="ts">
import FinancialDashboard from '~/components/financeiro/FinancialDashboard.vue'
import { pagamentosMock } from '~/data/pagamentos'

definePageMeta({
  title: 'Financeiro',
  description: 'Acompanhe pagamentos, reembolsos e valores dos eventos.',
  layout: 'admin-layout',
  sidebarActive: 'Financeiro'
})
</script>

<template>
  <FinancialDashboard :pagamentos="pagamentosMock" />
</template>
