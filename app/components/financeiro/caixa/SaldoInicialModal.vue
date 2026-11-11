<script setup lang="ts">
import { ref, watch } from 'vue'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import FormField from '~/components/FormField.vue'
import type { ContaCaixa } from '~/types/caixa'
import { lerValorReais } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'

const props = defineProps<{
  open: boolean
  conta: ContaCaixa | null
  salvando?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [valor: number]
}>()

const valor = ref('')
const erro = ref('')

watch(
  () => props.open,
  (aberto) => {
    if (!aberto) return
    valor.value = ''
    erro.value = ''
  }
)

function enviar() {
  const n = lerValorReais(valor.value)
  if (n === null) {
    erro.value = 'Informe o saldo (pode ser 0).'
    return
  }
  emit('submit', n)
}
</script>

<template>
  <BaseModal
    :open="props.open"
    :title="`Saldo de hoje: ${props.conta?.nome ?? ''}`"
    subtitle="Quanto tem nesta conta agora? O caixa passa a contar a partir deste momento."
    @close="emit('close')"
  >
    <div class="space-y-4">
      <FormField label="Saldo agora" required :error="erro" hint="Ex.: 1.250,00. Use o sinal de menos se estiver negativo.">
        <BaseInput v-model="valor" prefix="R$" placeholder="0,00" :invalid="!!erro" @keyup.enter="enviar" />
      </FormField>

      <p
        v-if="props.conta?.configurada"
        class="rounded-xl border border-red-400/30 bg-red-400/5 p-3 text-xs text-red-300"
      >
        Esta conta já foi configurada (saldo hoje: {{ formatMoeda(props.conta.saldoAtual) }}).
        Informar de novo recomeça a conta a partir de agora: os lançamentos de antes deixam de
        contar no saldo dela.
      </p>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" :disabled="props.salvando" @click="emit('close')">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="props.salvando" @click="enviar">
          {{ props.salvando ? 'Salvando...' : 'Salvar saldo' }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
