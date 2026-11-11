<script setup lang="ts">
import { ref, watch } from 'vue'

import AppButton from '~/components/AppButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import FormField from '~/components/FormField.vue'
import type { LancamentoCaixa } from '~/types/caixa'
import { formatarDataCurta, rotuloTipoLancamento } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'

const props = defineProps<{
  open: boolean
  lancamento: LancamentoCaixa | null
  salvando?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [motivo: string]
}>()

const motivo = ref('')
const erro = ref('')

watch(
  () => props.open,
  (aberto) => {
    if (aberto) {
      motivo.value = ''
      erro.value = ''
    }
  }
)

function enviar() {
  if (!motivo.value.trim()) {
    erro.value = 'Conte em poucas palavras por que está cancelando.'
    return
  }
  emit('submit', motivo.value)
}
</script>

<template>
  <BaseModal
    :open="props.open"
    title="Cancelar lançamento"
    subtitle="O lançamento sai do saldo, mas continua guardado no histórico."
    @close="emit('close')"
  >
    <div v-if="props.lancamento" class="space-y-4">
      <div class="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3 text-sm">
        <p class="font-semibold text-white">
          {{ rotuloTipoLancamento(props.lancamento.tipo) }} de {{ formatMoeda(props.lancamento.valor) }}
        </p>
        <p class="text-zinc-400">
          {{ formatarDataCurta(props.lancamento.data) }} ·
          {{ props.lancamento.descricao || props.lancamento.categoriaNome }}
        </p>
      </div>
      <FormField label="Motivo" required :error="erro">
        <BaseTextarea v-model="motivo" :rows="2" placeholder="Ex.: lançado em dobro" :invalid="!!erro" />
      </FormField>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" :disabled="props.salvando" @click="emit('close')">Voltar</AppButton>
        <AppButton variant="danger" :disabled="props.salvando" @click="enviar">
          {{ props.salvando ? 'Cancelando...' : 'Cancelar lançamento' }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
