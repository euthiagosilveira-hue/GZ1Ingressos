<script setup lang="ts">
import GateApp from '~/components/portaria/GateApp.vue'
import { eventosMock } from '~/data/eventos'
import { ingressosMock } from '~/data/ingressos'

definePageMeta({
  title: 'Portaria',
  description: 'Valide ingressos e registre entradas do evento.',
  layout: 'admin-layout',
  sidebarActive: 'Portaria'
})
</script>

<template>
  <GateApp :ingressos="ingressosMock" :eventos="eventosMock" />
</template>
