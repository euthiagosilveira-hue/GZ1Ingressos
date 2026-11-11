<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { PaperClipIcon, PlusIcon, SparklesIcon, TrashIcon, XMarkIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import BaseTextarea from '~/components/BaseTextarea.vue'
import FormField from '~/components/FormField.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import {
  enviarComprovante,
  lerComprovanteComIa,
  linkComprovante,
  listarItensLancamento
} from '~/services/admin/caixa'
import { podeComprimir } from '~/utils/comprimirImagem'
import type {
  CategoriaCaixa,
  LancamentoCaixa,
  LancamentoInput,
  TipoLancamento
} from '~/types/caixa'
import type { SelectOption } from '~/types/ui'
import {
  type ErrosLancamento,
  type FormItem,
  type FormLancamento,
  hojeIso,
  itemParaForm,
  itensDoForm,
  lerValorReais,
  somaItens,
  mensagemErroLeituraIa,
  validarLancamento
} from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'

const props = defineProps<{
  open: boolean
  /** Lancamento a editar (null = novo). */
  lancamento: LancamentoCaixa | null
  tipoInicial?: TipoLancamento
  eventoInicial?: string | null
  categorias: CategoriaCaixa[]
  contaOptions: SelectOption[]
  eventoOptions: SelectOption[]
  salvando?: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [input: LancamentoInput]
}>()

const tipoOptions: SelectOption[] = [
  { value: 'ENTRADA', label: 'Entrada' },
  { value: 'SAIDA', label: 'Saída' },
  { value: 'TRANSFERENCIA', label: 'Transferência' }
]

const form = reactive<FormLancamento>({
  tipo: 'SAIDA',
  data: hojeIso(),
  valor: '',
  descricao: '',
  categoriaId: '',
  contaId: '',
  contaDestinoId: '',
  eventoId: ''
})
const comprovante = ref<string | null>(null)
const erros = ref<ErrosLancamento>({})
const enviandoArquivo = ref(false)
const erroArquivo = ref('')
const inputArquivo = ref<HTMLInputElement | null>(null)
const lendoIa = ref(false)
const avisoIa = ref('')
const erroIa = ref('')
// Itens do comprovante (produtos). So vao para o banco se mudarem.
const itens = ref<FormItem[]>([])
const itensAlterados = ref(false)
const carregandoItens = ref(false)
const mostrarItens = ref(false)

const editando = computed(() => !!props.lancamento)

const categoriaOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Escolha a categoria' },
  ...props.categorias
    .filter(
      (c) =>
        c.tipo === form.tipo &&
        c.chaveSistema !== 'INGRESSOS' &&
        c.chaveSistema !== 'REEMBOLSO_INGRESSO' &&
        (c.ativa || c.id === form.categoriaId)
    )
    .map((c) => ({ value: c.id, label: c.ativa ? c.nome : `${c.nome} (inativa)` }))
])

const contaOptionsComVazio = computed<SelectOption[]>(() => [
  { value: '', label: 'Escolha a conta' },
  ...props.contaOptions
])

const titulo = computed(() => {
  if (editando.value) return 'Editar lançamento'
  if (form.tipo === 'ENTRADA') return 'Nova entrada'
  if (form.tipo === 'SAIDA') return 'Nova saída'
  return 'Transferência entre contas'
})

watch(
  () => props.open,
  (aberto) => {
    if (!aberto) return
    const l = props.lancamento
    form.tipo = l?.tipo ?? props.tipoInicial ?? 'SAIDA'
    form.data = l?.data ?? hojeIso()
    form.valor = l ? l.valor.toFixed(2).replace('.', ',') : ''
    form.descricao = l?.descricao ?? ''
    form.categoriaId = l?.categoriaId ?? ''
    form.contaId = l?.contaId ?? (props.contaOptions.length === 1 ? props.contaOptions[0]!.value : '')
    form.contaDestinoId = l?.contaDestinoId ?? ''
    form.eventoId = l?.eventoId ?? props.eventoInicial ?? ''
    comprovante.value = l?.comprovantePath ?? null
    erros.value = {}
    erroArquivo.value = ''
    avisoIa.value = ''
    erroIa.value = ''
    itens.value = []
    itensAlterados.value = false
    mostrarItens.value = false
    if (l?.lancamentoId && l.tipo !== 'TRANSFERENCIA') void carregarItens(l.lancamentoId)
  }
)

async function carregarItens(lancamentoId: string) {
  carregandoItens.value = true
  try {
    const lista = await listarItensLancamento(lancamentoId)
    if (props.lancamento?.lancamentoId !== lancamentoId || itensAlterados.value) return
    itens.value = lista.map(itemParaForm)
    mostrarItens.value = lista.length > 0
  } catch {
    // Sem itens (ou SQL ainda nao aplicado): o formulario segue normal.
  } finally {
    carregandoItens.value = false
  }
}

const itensValidos = computed(() => itensDoForm(itens.value))
const somaDosItens = computed(() => somaItens(itensValidos.value))
const diferencaItens = computed(() => {
  const valor = lerValorReais(form.valor)
  if (valor === null || itensValidos.value.length === 0) return 0
  return Math.round((valor - somaDosItens.value) * 100) / 100
})

function marcarItens() {
  itensAlterados.value = true
}

function adicionarItem() {
  itens.value.push({ descricao: '', quantidade: '1', valorTotal: '' })
  mostrarItens.value = true
  marcarItens()
}

function removerItem(indice: number) {
  itens.value.splice(indice, 1)
  marcarItens()
}

function usarSomaComoValor() {
  form.valor = somaDosItens.value.toFixed(2).replace('.', ',')
}

// Trocar entre entrada/saida limpa a categoria (as listas sao diferentes).
watch(
  () => form.tipo,
  (novo, antigo) => {
    if (antigo && novo !== antigo && !props.categorias.some((c) => c.id === form.categoriaId && c.tipo === novo)) {
      form.categoriaId = ''
    }
  }
)

function escolherArquivo() {
  inputArquivo.value?.click()
}

async function aoEscolherArquivo(evento: Event) {
  const alvo = evento.target as HTMLInputElement
  const arquivo = alvo.files?.[0]
  alvo.value = ''
  if (!arquivo) return
  // Fotos grandes sao reduzidas antes de subir; PDF e outros formatos tem limite de 10 MB.
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
    erroArquivo.value = 'Não foi possível enviar o comprovante. Use foto (JPG/PNG) ou PDF.'
    return
  } finally {
    enviandoArquivo.value = false
  }
  // Lancamento novo: a IA ja tenta preencher o que estiver em branco.
  if (!editando.value && form.tipo !== 'TRANSFERENCIA') await lerComIa(false)
}

const podeLerIa = computed(() => !!comprovante.value && form.tipo !== 'TRANSFERENCIA')

/**
 * Pede para a IA ler o comprovante. Automatico (sobrescrever=false) so
 * preenche campos vazios; pelo botao, troca pelo que a IA leu.
 */
async function lerComIa(sobrescrever: boolean) {
  if (!comprovante.value || form.tipo === 'TRANSFERENCIA') return
  const tipo = form.tipo
  lendoIa.value = true
  avisoIa.value = ''
  erroIa.value = ''
  try {
    const r = await lerComprovanteComIa(comprovante.value, tipo)
    if (form.tipo !== tipo) return
    const preenchidos: string[] = []
    if (r.valor !== null && (sobrescrever || !form.valor.trim())) {
      form.valor = r.valor.toFixed(2).replace('.', ',')
      preenchidos.push('valor')
    }
    if (r.data && (sobrescrever || form.data === hojeIso() || !form.data)) {
      form.data = r.data
      preenchidos.push('data')
    }
    if (r.descricao && (sobrescrever || !form.descricao.trim())) {
      form.descricao = r.descricao
      preenchidos.push('descrição')
    }
    if (r.categoriaId && (sobrescrever || !form.categoriaId) && props.categorias.some((c) => c.id === r.categoriaId)) {
      form.categoriaId = r.categoriaId
      preenchidos.push('categoria')
    }
    if (r.itens?.length && (sobrescrever || itensValidos.value.length === 0)) {
      itens.value = r.itens.map(itemParaForm)
      itensAlterados.value = true
      mostrarItens.value = true
      preenchidos.push(`${r.itens.length} ${r.itens.length === 1 ? 'item' : 'itens'}`)
    }
    avisoIa.value = preenchidos.length
      ? `A IA preencheu: ${preenchidos.join(', ')}. Confira antes de lançar.`
      : 'A IA leu o comprovante, mas não havia nada novo para preencher.'
  } catch (e) {
    erroIa.value = mensagemErroLeituraIa(e)
  } finally {
    lendoIa.value = false
  }
}

async function verComprovante() {
  if (!comprovante.value) return
  try {
    window.open(await linkComprovante(comprovante.value), '_blank', 'noopener')
  } catch {
    erroArquivo.value = 'Não foi possível abrir o comprovante.'
  }
}

function enviar() {
  erros.value = validarLancamento(form)
  if (Object.keys(erros.value).length > 0) return
  emit('submit', {
    id: props.lancamento?.lancamentoId ?? null,
    tipo: form.tipo,
    data: form.data,
    valor: lerValorReais(form.valor) ?? 0,
    descricao: form.descricao,
    categoriaId: form.tipo === 'TRANSFERENCIA' ? null : form.categoriaId || null,
    contaId: form.contaId,
    contaDestinoId: form.tipo === 'TRANSFERENCIA' ? form.contaDestinoId || null : null,
    eventoId: form.eventoId || null,
    comprovantePath: comprovante.value,
    itens: form.tipo !== 'TRANSFERENCIA' && itensAlterados.value ? itensValidos.value : null
  })
}
</script>

<template>
  <BaseModal :open="props.open" :title="titulo" @close="emit('close')">
    <div class="space-y-4">
      <SegmentedControl v-model="form.tipo" :options="tipoOptions" />

      <p v-if="form.tipo === 'TRANSFERENCIA'" class="text-xs text-zinc-500">
        Use para mover dinheiro de uma conta para outra (ex.: depositar o dinheiro do caixa no
        Itaú). Não conta como entrada nem como saída.
      </p>

      <FormField label="Comprovante" :error="erroArquivo">
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
            <span class="truncate">Ver comprovante anexado</span>
          </button>
          <button
            v-if="podeLerIa"
            type="button"
            title="Ler o comprovante com IA e preencher"
            aria-label="Ler o comprovante com IA e preencher"
            :disabled="lendoIa"
            class="cursor-pointer rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 disabled:cursor-wait disabled:opacity-50"
            @click="lerComIa(true)"
          >
            <SparklesIcon class="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Remover comprovante"
            :disabled="lendoIa"
            class="cursor-pointer rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
            @click="comprovante = null; avisoIa = ''; erroIa = ''"
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
          <PaperClipIcon v-else class="h-4 w-4" />
          {{ enviandoArquivo ? 'Enviando o comprovante...' : 'Anexar foto ou PDF (opcional)' }}
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
            <p class="text-sm font-medium text-amber-300">Lendo o comprovante com IA...</p>
            <p class="text-xs text-zinc-400">Leva alguns segundos. Os campos abaixo vão ser preenchidos.</p>
          </div>
        </div>
        <p v-else-if="avisoIa" class="mt-2 flex items-start gap-1.5 text-xs text-amber-300">
          <SparklesIcon class="mt-px h-4 w-4 shrink-0" /> {{ avisoIa }}
        </p>
        <p v-else-if="erroIa" class="mt-2 text-xs text-zinc-400">{{ erroIa }}</p>
        <p v-else-if="!comprovante && !editando && form.tipo !== 'TRANSFERENCIA'" class="mt-2 text-xs text-zinc-500">
          Anexe primeiro: a IA lê o comprovante e preenche valor, data, descrição, categoria e os itens.
        </p>
      </FormField>

      <div class="space-y-4 transition-opacity" :class="lendoIa ? 'pointer-events-none opacity-40' : ''">
        <div class="grid grid-cols-2 gap-3">
          <FormField label="Data" required :error="erros.data">
            <BaseInput v-model="form.data" type="date" :invalid="!!erros.data" />
          </FormField>
          <FormField label="Valor" required :error="erros.valor">
            <BaseInput v-model="form.valor" prefix="R$" placeholder="0,00" :invalid="!!erros.valor" />
          </FormField>
        </div>

        <FormField v-if="form.tipo !== 'TRANSFERENCIA'" label="Categoria" required :error="erros.categoriaId">
          <BaseSelect v-model="form.categoriaId" :options="categoriaOptions" />
        </FormField>

        <div class="grid gap-3" :class="form.tipo === 'TRANSFERENCIA' ? 'grid-cols-2' : ''">
          <FormField
            :label="form.tipo === 'TRANSFERENCIA' ? 'Sai de' : form.tipo === 'ENTRADA' ? 'Entrou em' : 'Saiu de'"
            required
            :error="erros.contaId"
          >
            <BaseSelect v-model="form.contaId" :options="contaOptionsComVazio" />
          </FormField>
          <FormField v-if="form.tipo === 'TRANSFERENCIA'" label="Vai para" required :error="erros.contaDestinoId">
            <BaseSelect v-model="form.contaDestinoId" :options="contaOptionsComVazio" />
          </FormField>
        </div>

        <FormField label="Descrição" hint="Ex.: Conta de luz de outubro, cachê da banda X.">
          <BaseTextarea v-model="form.descricao" :rows="2" placeholder="Opcional" />
        </FormField>

        <!-- Itens do comprovante (produtos), para o historico de compras -->
        <div v-if="form.tipo !== 'TRANSFERENCIA'" class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <p class="text-sm font-medium text-zinc-300">
              Itens
              <span v-if="itensValidos.length" class="text-xs font-normal text-zinc-500">
                ({{ itensValidos.length }})
              </span>
            </p>
            <span v-if="carregandoItens" class="text-xs text-zinc-500">Carregando...</span>
            <button
              v-else-if="!mostrarItens"
              type="button"
              class="cursor-pointer text-xs font-medium text-amber-400 hover:text-amber-300"
              @click="adicionarItem"
            >
              + Adicionar itens (opcional)
            </button>
          </div>

          <template v-if="mostrarItens">
            <div class="hidden grid-cols-[3.5rem_1fr_6.5rem_2rem] gap-2 px-1 text-[11px] uppercase tracking-wide text-zinc-500 sm:grid">
              <span>Qtd.</span><span>Produto</span><span class="text-right">Valor total</span><span />
            </div>
            <ul class="space-y-2">
              <li
                v-for="(item, i) in itens"
                :key="i"
                class="grid grid-cols-[3.5rem_1fr_2rem] gap-2 rounded-lg border border-zinc-800 p-2 sm:grid-cols-[3.5rem_1fr_6.5rem_2rem] sm:border-0 sm:p-0"
              >
                <input
                  v-model="item.quantidade"
                  inputmode="decimal"
                  aria-label="Quantidade"
                  class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-center text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  @input="marcarItens"
                />
                <input
                  v-model="item.descricao"
                  aria-label="Produto"
                  placeholder="Produto"
                  class="w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                  @input="marcarItens"
                />
                <button
                  type="button"
                  aria-label="Remover item"
                  class="row-span-2 cursor-pointer self-center rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-red-400 sm:order-last sm:row-span-1"
                  @click="removerItem(i)"
                >
                  <XMarkIcon class="h-4 w-4" />
                </button>
                <div class="col-span-2 flex items-center rounded-lg border border-zinc-700 bg-zinc-950 focus-within:border-amber-400 sm:col-span-1">
                  <span class="pl-2 text-xs text-zinc-500">R$</span>
                  <input
                    v-model="item.valorTotal"
                    inputmode="decimal"
                    aria-label="Valor total do item"
                    placeholder="0,00"
                    class="w-full min-w-0 bg-transparent px-2 py-2 text-right text-sm text-zinc-100 focus:outline-none"
                    @input="marcarItens"
                  />
                </div>
              </li>
            </ul>
            <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                class="flex cursor-pointer items-center gap-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                @click="adicionarItem"
              >
                <PlusIcon class="h-4 w-4" /> Adicionar item
              </button>
              <p v-if="itensValidos.length" class="text-xs text-zinc-400">
                Soma dos itens: <span class="font-semibold text-zinc-200">{{ formatMoeda(somaDosItens) }}</span>
              </p>
            </div>
            <p v-if="diferencaItens !== 0" class="text-xs text-amber-300/90">
              A soma dos itens é diferente do valor ({{ diferencaItens > 0 ? 'faltam' : 'sobram' }}
              {{ formatMoeda(Math.abs(diferencaItens)) }}). Pode ser desconto ou taxa; se for erro,
              <button type="button" class="cursor-pointer underline hover:text-amber-200" @click="usarSomaComoValor">
                usar a soma como valor
              </button>.
            </p>
            <p v-if="itensValidos.length" class="text-xs text-zinc-500">
              Os itens ficam guardados na aba "Itens comprados".
            </p>
          </template>
        </div>

        <FormField label="Evento" hint="Ligue ao evento para ver depois quanto cada noite custou e rendeu.">
          <BaseSelect v-model="form.eventoId" :options="props.eventoOptions" />
        </FormField>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" :disabled="props.salvando" @click="emit('close')">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="props.salvando || enviandoArquivo || lendoIa" @click="enviar">
          {{ props.salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Lançar' }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
