<script setup lang="ts">
import { toast } from 'vue3-toastify'

import EventForm from '~/components/eventos/EventForm.vue'
import type { EventPayload } from '~/types/evento'

definePageMeta({
  title: 'Criar evento',
  description: 'Preencha as informações do seu evento.',
  layout: 'admin-layout',
  sidebarActive: 'Eventos',
  middleware: ['admin-auth']
})

function aoSubmeter(_payload: EventPayload) {
  toast.success('Evento salvo com sucesso!')
  navigateTo('/eventos')
}

function aoCancelar() {
  navigateTo('/eventos')
}
</script>

<template>
  <EventForm mode="create" @submit="aoSubmeter" @cancel="aoCancelar" />
</template>
