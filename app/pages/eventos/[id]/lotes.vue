<script setup lang="ts">
import { computed } from 'vue'

import LotEventNotFound from '~/components/lotes/LotEventNotFound.vue'
import LotManager from '~/components/lotes/LotManager.vue'
import { eventosMock } from '~/data/eventos'

definePageMeta({
  title: 'Lotes',
  description: 'Gerencie os preços e as etapas de venda deste evento.',
  layout: 'admin-layout',
  sidebarActive: 'Eventos'
})

const route = useRoute()
const evento = computed(() => eventosMock.find((item) => item.id === route.params.id) ?? null)
</script>

<template>
  <LotManager v-if="evento" :evento="evento" />
  <LotEventNotFound v-else />
</template>
