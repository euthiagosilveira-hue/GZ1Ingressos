<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { CameraIcon, PaperClipIcon, SparklesIcon, TrashIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import FormField from '~/components/FormField.vue'
import type { EventoOpcao } from '~/composables/useCaixaBase'
import type { ContaCaixa } from '~/types/caixa'
import type { SelectOption } from '~/types/ui'
import { enviarComprovante, lerFechamentoBarComIa, linkComprovante } from '~/services/admin/caixa'
import { podeComprimir } from '~/utils/comprimirImagem'
import { distribuirFechamentoBar, hojeIso, lerValorReais, mensagemErroLeituraIa } from '~/utils/caixa'
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
  submit: [
    input: {
      data: string
      eventoId: string | null
      valores: { contaId: string; valor: number; detalhe: string | null }[]
      observacao: string
      comprovantePath: string | null
    }
  ]
}>()

const data = ref(hojeIso())
const eventoId = ref('')
const observacao = ref('')
const valores = reactive<Record<string, string>>({})
const erro = ref('')

// Foto do fechamento de caixa impresso na maquininha (lida pela IA).
const comprovante = ref<string | null>(null)
const inputArquivo = ref<HTMLInputElement | null>(null)
const enviandoArquivo = ref(false)
const erroArquivo = ref('')
const lendoIa = ref(false)
const avisoIa = ref('')
const erroIa = ref('')
const diferencaIa = ref(0)
/** Como a IA formou o valor de cada conta (vai na descricao do lancamento). */
const detalhes = reactive<Record<string, string>>({})
/** Valor que a IA colocou em cada conta (se a pessoa mudar, o detalhe sai). */
const valoresIa = reactive<Record<string, string>>({})

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
    limparLeitura()
    comprovante.value = null
    erroArquivo.value = ''
  }
)

watch(data, (dia) => {
  if (props.open) eventoId.value = eventoDoDia(dia) || eventoId.value
})

function limparLeitura() {
  avisoIa.value = ''
  erroIa.value = ''
  diferencaIa.value = 0
  for (const k of Object.keys(detalhes)) delete detalhes[k]
  for (const k of Object.keys(valoresIa)) delete valoresIa[k]
}

function paraCampo(valor: number): string {
  return valor.toFixed(2).replace('.', ',')
}

function escolherArquivo() {
  inputArquivo.value?.click()
}

async function aoEscolherArquivo(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  const arquivo = alvo.files?.[0]
  alvo.value = ''
  if (!arquivo) return
  const limite = podeComprimir(arquivo.type, arquivo.size) ? 40 * 1024 * 1024 : 10 * 1024 * 1024
  if (arquivo.size > limite) {
    erroArquivo.value = 'O arquivo é grande demais (máximo 10 MB para PDF, 40 MB para foto).'
    return
  }
  erroArquivo.value = ''
  enviandoArquivo.value = true
  try {
    comprovante.value = await enviarComprovante(arquivo)
  } catch {
    erroArquivo.value = 'Não foi possível enviar a foto. Use foto (JPG/PNG) ou PDF.'
    return
  } finally {
    enviandoArquivo.value = false
  }
  await lerComIa()
}

/** A IA le o fechamento e preenche o valor de cada conta (Itau e dinheiro). */
async function lerComIa() {
  if (!comprovante.value) return
  lendoIa.value = true
  limparLeitura()
  try {
    const leitura = await lerFechamentoBarComIa(comprovante.value)
    const r = distribuirFechamentoBar(leitura, contasBar.value)
    if (Object.keys(r.valores).length === 0) {
      erroIa.value = leitura.total
        ? `A IA achou só o total (${formatMoeda(leitura.total)}), sem separar as formas de pagamento. Preencha à mão.`
        : 'A IA não achou os valores por forma de pagamento. Preencha à mão.'
      return
    }
    for (const c of contasBar.value) {
      const v = r.valores[c.id]
      valores[c.id] = v ? paraCampo(v) : ''
      if (v) {
        valoresIa[c.id] = paraCampo(v)
        detalhes[c.id] = r.detalhes[c.id] ?? ''
      }
    }
    if (leitura.data) data.value = leitura.data
    diferencaIa.value = r.diferenca
    avisoIa.value = 'A IA preencheu os valores pelo comprovante. Confira antes de lançar.'
  } catch (e) {
    erroIa.value = mensagemErroLeituraIa(e)
  } finally {
    lendoIa.value = false
  }
}

function removerComprovante() {
  comprovante.value = null
  limparLeitura()
}

async function verComprovante() {
  if (!comprovante.value) return
  try {
    window.open(await linkComprovante(comprovante.value), '_blank', 'noopener')
  } catch {
    erroArquivo.value = 'Não foi possível abrir a foto.'
  }
}

function enviar() {
  const itens: { contaId: string; valor: number; detalhe: string | null }[] = []
  for (const c of contasBar.value) {
    const bruto = valores[c.id] ?? ''
    if (bruto.trim() === '') continue
    const n = lerValorReais(bruto)
    if (n === null || n < 0) {
      erro.value = `Valor inválido em ${c.nome}.`
      return
    }
    // O detalhe (credito/debito/Pix) so vai se o valor ainda e o que a IA leu.
    const detalhe = detalhes[c.id] && valoresIa[c.id] === bruto.trim() ? detalhes[c.id]! : null
    if (n > 0) itens.push({ contaId: c.id, valor: n, detalhe })
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
  emit('submit', {
    data: data.value,
    eventoId: eventoId.value || null,
    valores: itens,
    observacao: observacao.value,
    comprovantePath: comprovante.value
  })
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
      <!-- Foto do fechamento de caixa: a IA le e preenche -->
      <div class="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <input
          ref="inputArquivo"
          type="file"
          accept="image/*,application/pdf"
          class="hidden"
          @change="aoEscolherArquivo"
        />
        <div v-if="comprovante" class="flex items-center gap-2">
          <button
            type="button"
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-left text-sm text-amber-400 hover:bg-zinc-800"
            @click="verComprovante"
          >
            <PaperClipIcon class="h-4 w-4 shrink-0" />
            <span class="truncate">Ver foto do fechamento</span>
          </button>
          <button
            type="button"
            title="Ler de novo com IA"
            aria-label="Ler de novo com IA"
            :disabled="lendoIa"
            class="cursor-pointer rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 disabled:cursor-wait disabled:opacity-50"
            @click="lerComIa"
          >
            <SparklesIcon class="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Remover foto"
            :disabled="lendoIa"
            class="cursor-pointer rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
            @click="removerComprovante"
          >
            <TrashIcon class="h-5 w-5" />
          </button>
        </div>
        <AppButton v-else variant="ghost" size="sm" :disabled="enviandoArquivo" @click="escolherArquivo">
          <span
            v-if="enviandoArquivo"
            class="h-4 w-4 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400"
            aria-hidden="true"
          />
          <CameraIcon v-else class="h-4 w-4" />
          {{ enviandoArquivo ? 'Enviando a foto...' : 'Foto do fechamento da maquininha' }}
        </AppButton>

        <div
          v-if="lendoIa"
          class="mt-3 flex items-center gap-3 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2.5"
          role="status"
          aria-live="polite"
        >
          <span
            class="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400"
            aria-hidden="true"
          />
          <div class="min-w-0">
            <p class="text-sm font-medium text-amber-300">Lendo o fechamento com IA...</p>
            <p class="text-xs text-zinc-400">Leva alguns segundos. Os valores abaixo vão ser preenchidos.</p>
          </div>
        </div>
        <template v-else-if="avisoIa">
          <p class="mt-2 flex items-start gap-1.5 text-xs text-amber-300">
            <SparklesIcon class="mt-px h-4 w-4 shrink-0" /> {{ avisoIa }}
          </p>
          <p v-if="diferencaIa !== 0" class="mt-1 text-xs text-red-400">
            Atenção: a soma das formas de pagamento não bate com o total impresso no comprovante
            (diferença de {{ formatMoeda(Math.abs(diferencaIa)) }}). Confira a foto.
          </p>
        </template>
        <p v-else-if="erroIa" class="mt-2 text-xs text-zinc-400">{{ erroIa }}</p>
        <p v-else-if="erroArquivo" class="mt-2 text-xs text-red-400">{{ erroArquivo }}</p>
        <p v-else-if="!comprovante" class="mt-2 text-xs text-zinc-500">
          Opcional. Tire foto do comprovante de fechamento: a IA separa dinheiro, crédito, débito e Pix. O
          dinheiro vai para o Caixa físico e o cartão e o Pix para o Itaú.
        </p>
      </div>

      <div class="space-y-4 transition-opacity" :class="lendoIa ? 'pointer-events-none opacity-40' : ''">
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
            <p
              v-if="detalhes[conta.id] && valoresIa[conta.id] === (valores[conta.id] ?? '').trim()"
              class="mt-1 text-xs text-zinc-500"
            >
              {{ detalhes[conta.id] }}
            </p>
          </FormField>
          <div class="flex items-center justify-between border-t border-zinc-800 pt-3 text-sm">
            <span class="text-zinc-400">Total do bar</span>
            <span class="text-lg font-bold text-white">{{ formatMoeda(total) }}</span>
          </div>
        </div>

        <FormField label="Observação" hint="Opcional. Ex.: Sexta, festa X.">
          <BaseInput v-model="observacao" placeholder="Opcional" />
        </FormField>
      </div>

      <p v-if="erro" class="text-sm text-red-400">{{ erro }}</p>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" :disabled="props.salvando" @click="emit('close')">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="props.salvando || lendoIa || enviandoArquivo" @click="enviar">
          {{ props.salvando ? 'Salvando...' : 'Lançar bar' }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
