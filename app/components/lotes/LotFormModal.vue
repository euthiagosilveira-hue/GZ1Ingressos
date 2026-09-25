<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from '~/components/BaseModal.vue'
import LotForm from '~/components/lotes/LotForm.vue'
import type { LotFormMode, LotFormValue, LotOrdemRef, LotPayload } from '~/types/lote'

const props = withDefaults(
  defineProps<{
    open: boolean
    mode?: LotFormMode
    initialValue?: Partial<LotFormValue>
    ordens?: LotOrdemRef[]
    idAtual?: string
  }>(),
  {
    mode: 'create',
    initialValue: () => ({}),
    ordens: () => [],
    idAtual: ''
  }
)

const emit = defineEmits<{
  submit: [payload: LotPayload]
  cancel: []
}>()

const titulo = computed(() => (props.mode === 'create' ? 'Novo lote' : 'Editar lote'))
const subtitulo = computed(() =>
  props.mode === 'create'
    ? 'Defina preço, quantidade e forma de ativação.'
    : 'Atualize os dados deste lote.'
)
</script>

<template>
  <BaseModal
    :open="props.open"
    :title="titulo"
    :subtitle="subtitulo"
    size="lg"
    @close="emit('cancel')"
  >
    <LotForm
      :mode="props.mode"
      :initial-value="props.initialValue"
      :ordens="props.ordens"
      :id-atual="props.idAtual"
      @submit="emit('submit', $event)"
      @cancel="emit('cancel')"
    />
  </BaseModal>
</template>
