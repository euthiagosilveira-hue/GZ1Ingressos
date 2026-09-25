<script setup lang="ts">
import { computed } from 'vue'

import BaseCard from '~/components/BaseCard.vue'
import BaseInput from '~/components/BaseInput.vue'
import FormField from '~/components/FormField.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import LotStatusBadge from '~/components/lotes/LotStatusBadge.vue'
import { descricaoAtivacao } from '~/utils/lotes'
import type { SelectOption } from '~/types/ui'
import type { LotActivationType, LotFormErrors, LotFormValue } from '~/types/lote'

const props = defineProps<{
  value: LotFormValue
  errors: LotFormErrors
}>()

const opcoes: SelectOption[] = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'ESGOTAMENTO', label: 'Após esgotamento' },
  { value: 'DATA_HORA', label: 'Data e hora' }
]

const descricao = computed(() => descricaoAtivacao(props.value.tipoAtivacao))

function definirTipo(tipo: string) {
  props.value.tipoAtivacao = tipo as LotActivationType
}
</script>

<template>
  <BaseCard class="space-y-5">
    <h3 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">Ativação</h3>

    <FormField label="Tipo de ativação" required :error="errors.tipoAtivacao">
      <SegmentedControl
        :model-value="value.tipoAtivacao"
        :options="opcoes"
        @update:model-value="definirTipo"
      />
      <p v-if="!errors.tipoAtivacao" class="mt-2 text-xs text-zinc-500">{{ descricao }}</p>
    </FormField>

    <div v-if="value.tipoAtivacao === 'DATA_HORA'" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Data de ativação" required :error="errors.dataAtivacao">
        <BaseInput v-model="value.dataAtivacao" type="date" :invalid="!!errors.dataAtivacao" />
      </FormField>
      <FormField label="Horário de ativação" required :error="errors.horaAtivacao">
        <BaseInput v-model="value.horaAtivacao" type="time" :invalid="!!errors.horaAtivacao" />
      </FormField>
    </div>

    <div class="space-y-2 border-t border-zinc-800 pt-4">
      <p class="text-[11px] uppercase tracking-wide text-zinc-500">Status</p>
      <LotStatusBadge :status="value.status" />
      <p class="text-xs text-zinc-500">
        O status muda por ações operacionais, não pela edição.
      </p>
    </div>
  </BaseCard>
</template>
