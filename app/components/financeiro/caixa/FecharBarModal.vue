<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import FormField from '~/components/FormField.vue'
import type { EventoOpcao } from '~/composables/useCaixaBase'
import type { ContaCaixa } from '~/types/caixa'
import type { SelectOption } from '~/types/ui'
import { hojeIso, lerValorReais } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'

const props = defineProps<{
  open: boolean
  contas: ContaCaixa[]
  eventos: EventoOpcao[]
  eventoOptions: SelectOption[]
  salvando?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [input: { data: string; eventoId: string | null; valores: { contaId: string; valor: number }[]; observacao: string }]
}>()

const data = ref(hojeIso())
const eventoId = ref('')
const observacao = ref('')
const valores = reactive<Record<string, string>>({})
const erro = ref('')

// Bar entra pelas maquininhas, banco e dinheiro (nao pelo Mercado Pago dos ingressos online).
const contasBar = computed(() => props.contas.filter((c) => c.ativa && c.tipo !== 'ONLINE'))

const total = computed(() =>
  contasBar.value.reduce((s, c) => s + (lerValorReais(valores[c.id] ?? '') ?? 0), 0)
)

/** Evento do dia escolhido (para pre-selecionar). */
function eventoDoDia(dia: string): string {
  const doDia = props.eventos.find((e) => {
    const inicio = new Date(e.inicioEm)
    // Evento que comecou no dia ou na noite anterior (madrugada).
    const diaEvento = hojeIso(inicio)
    const diaAntes = hojeIso(new Date(inicio.getTime() + 12 * 3_600_000))
    return diaEvento === dia || diaAntes === dia
  })
  return doDia?.id ?? ''
}

watch(
  () => props.open,
  (aberto) => {
    if (!aberto) return
    data.value = hojeIso()
    eventoId.value = eventoDoDia(data.value)
    observacao.value = ''
    for (const k of Object.keys(valores)) delete valores[k]
    for (const c of contasBar.value) valores[c.id] = ''
    erro.value = ''
  }
)

watch(data, (dia) => {
  if (props.open) eventoId.value = eventoDoDia(dia) || eventoId.value
})

function enviar() {
  const itens: { contaId: string; valor: number }[] = []
  for (const c of contasBar.value) {
    const bruto = valores[c.id] ?? ''
    if (bruto.trim() === '') continue
    const n = lerValorReais(bruto)
    if (n === null || n < 0) {
      erro.value = `Valor inválido em ${c.nome}.`
      return
    }
    if (n > 0) itens.push({ contaId: c.id, valor: n })
  }
  if (itens.length === 0) {
    erro.value = 'Informe o valor de pelo menos uma maquininha ou do dinheiro.'
    return
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.value)) {
    erro.value = 'Informe a data.'
    return
  }
  erro.value = ''
  emit('submit', { data: data.value, eventoId: eventoId.value || null, valores: itens, observacao: observacao.value })
}
</script>

<template>
  <BaseModal
    :open="props.open"
    title="Fechar bar da noite"
    subtitle="Lance o total vendido no bar em cada maquininha e em dinheiro. Cada valor vira uma entrada na conta certa."
    @close="emit('close')"
  >
    <div class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <FormField label="Data" required>
          <BaseInput v-model="data" type="date" />
        </FormField>
        <FormField label="Evento">
          <BaseSelect v-model="eventoId" :options="props.eventoOptions" />
        </FormField>
      </div>

      <div class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Total vendido no bar</p>
        <FormField v-for="conta in contasBar" :key="conta.id" :label="conta.nome">
          <BaseInput
            :model-value="valores[conta.id] ?? ''"
            prefix="R$"
            placeholder="0,00"
            @update:model-value="valores[conta.id] = $event"
          />
        </FormField>
        <div class="flex items-center justify-between border-t border-zinc-800 pt-3 text-sm">
          <span class="text-zinc-400">Total do bar</span>
          <span class="text-lg font-bold text-white">{{ formatMoeda(total) }}</span>
        </div>
      </div>

      <FormField label="Observação" hint="Opcional. Ex.: Sexta, festa X.">
        <BaseInput v-model="observacao" placeholder="Opcional" />
      </FormField>

      <p v-if="erro" class="text-sm text-red-400">{{ erro }}</p>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" :disabled="props.salvando" @click="emit('close')">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="props.salvando" @click="enviar">
          {{ props.salvando ? 'Salvando...' : 'Lançar bar' }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
