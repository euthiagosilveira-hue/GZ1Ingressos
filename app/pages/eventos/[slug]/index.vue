<script setup lang="ts">
import { computed } from 'vue'

import PublicEventNotFound from '~/components/public/eventos/PublicEventNotFound.vue'
import PublicEventPage from '~/components/public/eventos/PublicEventPage.vue'
import { buscarEventoPublico } from '~/data/eventosPublicos'

const route = useRoute()
const evento = computed(() => buscarEventoPublico(String(route.params.slug)))

useSeoMeta({
  title: () => (evento.value ? `${evento.value.nome} | GZ1 Ingresso` : 'Evento | GZ1 Ingresso'),
  description: () =>
    evento.value
      ? evento.value.descricao.slice(0, 155)
      : 'Confira os eventos da Galeria Zero 1.'
})
</script>

<template>
  <PublicEventPage v-if="evento" :evento="evento" />
  <PublicEventNotFound v-else />
</template>
