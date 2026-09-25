<script setup lang="ts">
import EntryList from '~/components/entradas/EntryList.vue'
import { entradasMock } from '~/data/entradas'

definePageMeta({
  title: 'Entradas',
  description: 'Consulte e audite os acessos registrados nos eventos.',
  layout: 'admin-layout',
  sidebarActive: 'Entradas'
})
</script>

<template>
  <EntryList :entradas="entradasMock" />
</template>
