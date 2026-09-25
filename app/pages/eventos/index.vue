<script setup lang="ts">
import { computed, ref } from 'vue'
import { PlusIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import PageHeader from '~/components/PageHeader.vue'
import EventFilters from '~/components/eventos/EventFilters.vue'
import EventGrid from '~/components/eventos/EventGrid.vue'
import { eventosMock } from '~/data/eventos'
import { filtrarEventos } from '~/utils/eventos'
import type { EventFiltersState } from '~/types/evento'

definePageMeta({
  title: 'Eventos',
  description: 'Gerencie seus eventos, vendas e ingressos.',
  layout: 'admin-layout',
  sidebarActive: 'Eventos'
})

const filtros = ref<EventFiltersState>({
  busca: '',
  status: 'TODOS',
  publicacao: 'TODOS'
})

const eventosFiltrados = computed(() => filtrarEventos(eventosMock, filtros.value))

function irParaCriar() {
  navigateTo('/eventos/novo')
}

function editarEvento() {
  navigateTo('/eventos/novo')
}

function acaoEvento(payload: { id: string; action: string }) {
  if (payload.action === 'lotes') {
    navigateTo(`/eventos/${payload.id}/lotes`)
  }
}
</script>

<template>
  <PageHeader title="Eventos" subtitle="Gerencie seus eventos, vendas e ingressos.">
    <template #actions>
      <AppButton variant="primary" @click="irParaCriar">
        <PlusIcon class="h-4 w-4" />
        Criar evento
      </AppButton>
    </template>
  </PageHeader>

  <EventFilters v-model="filtros" />

  <EventGrid
    :events="eventosFiltrados"
    @edit="editarEvento"
    @action="acaoEvento"
    @create="irParaCriar"
  />
</template>
