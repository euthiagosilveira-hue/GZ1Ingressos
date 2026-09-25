<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import type { SelectOption } from '~/types/ui'
import type { GateSimulationOption } from '~/types/portaria'

const props = defineProps<{
  opcoes: GateSimulationOption[]
}>()

const emit = defineEmits<{
  simular: [id: string]
}>()

const selecionado = ref('')

watch(
  () => props.opcoes,
  (lista) => {
    if (!lista.some((opcao) => opcao.id === selecionado.value)) {
      selecionado.value = lista[0]?.id ?? ''
    }
  },
  { immediate: true }
)

const opcoesSelect = computed<SelectOption[]>(() =>
  props.opcoes.map((opcao) => ({
    value: opcao.id,
    label:
      opcao.codigo !== '—' ? `${opcao.rotulo} · ${opcao.codigo}` : opcao.rotulo
  }))
)

function simular() {
  if (selecionado.value) emit('simular', selecionado.value)
}
</script>

<template>
  <BaseCard :padded="false" class="space-y-3 border-dashed p-4">
    <span
      class="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300"
    >
      Simulação de desenvolvimento
    </span>

    <BaseSelect v-model="selecionado" :options="opcoesSelect" label="Caso de teste" />

    <AppButton variant="primary" block @click="simular">Simular leitura</AppButton>

    <p class="text-xs text-zinc-500">
      Este bloco é apenas para testes e não representa a operação final.
    </p>
  </BaseCard>
</template>
