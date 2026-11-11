<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { toast } from 'vue3-toastify'
import {
  ArrowDownTrayIcon,
  ArrowsRightLeftIcon,
  MinusIcon,
  PlusIcon,
  BeakerIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BasePagination from '~/components/BasePagination.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import PageHeader from '~/components/PageHeader.vue'
import CancelarLancamentoModal from '~/components/financeiro/caixa/CancelarLancamentoModal.vue'
import ContasCaixaCards from '~/components/financeiro/caixa/ContasCaixaCards.vue'
import FecharBarModal from '~/components/financeiro/caixa/FecharBarModal.vue'
import FinanceiroAbas from '~/components/financeiro/caixa/FinanceiroAbas.vue'
import LancamentoModal from '~/components/financeiro/caixa/LancamentoModal.vue'
import LancamentosLista from '~/components/financeiro/caixa/LancamentosLista.vue'
import SaldoInicialModal from '~/components/financeiro/caixa/SaldoInicialModal.vue'
import { useCaixaBase } from '~/composables/useCaixaBase'
import {
  cancelarLancamentoCaixa,
  definirSaldoInicialConta,
  fecharBarCaixa,
  linkComprovante,
  listarLancamentosCaixa,
  ErroItensLancamento,
  salvarLancamentoCaixa
} from '~/services/admin/caixa'
import type {
  ContaCaixa,
  LancamentoCaixa,
  LancamentoInput,
  ResumoLancamentos,
  TipoLancamento
} from '~/types/caixa'
import type { SelectOption } from '~/types/ui'
import {
  COLUNAS_PLANILHA_LANCAMENTOS,
  PRESETS_PERIODO,
  type PresetPeriodo,
  formatarDataCurta,
  intervaloPreset,
  linhasPlanilhaLancamentos,
  mensagemErroCaixa
} from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'
import { paginar, totalPaginas } from '~/utils/paginacao'
import { baixarPlanilhaXlsx } from '~/utils/planilhaXlsx'

const POR_PAGINA = 30

const route = useRoute()
const {
  contas,
  categorias,
  eventos,
  erroBase,
  contaOptions,
  eventoOptions,
  carregarBase,
  carregarContas
} = useCaixaBase()

const filtros = reactive({
  periodo: 'ESTE_MES' as PresetPeriodo,
  contaId: '',
  categoriaId: '',
  eventoId: typeof route.query.evento === 'string' ? route.query.evento : '',
  tipo: '',
  busca: '',
  incluirCancelados: false
})

const itens = ref<LancamentoCaixa[]>([])
const resumo = ref<ResumoLancamentos>({
  entradas: 0,
  saidas: 0,
  transferenciasEntrada: 0,
  transferenciasSaida: 0,
  quantidade: 0
})
const carregando = ref(true)
const erroLista = ref('')
const pagina = ref(1)

const periodoOptions: SelectOption[] = PRESETS_PERIODO.map((p) => ({ value: p.value, label: p.label }))
const tipoOptions: SelectOption[] = [
  { value: '', label: 'Entradas, saídas e transferências' },
  { value: 'ENTRADA', label: 'Só entradas' },
  { value: 'SAIDA', label: 'Só saídas' },
  { value: 'TRANSFERENCIA', label: 'Só transferências' }
]
const contaFiltroOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Todas as contas' },
  ...contas.value.map((c) => ({ value: c.id, label: c.nome }))
])
const categoriaFiltroOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Todas as categorias' },
  ...categorias.value.map((c) => ({
    value: c.id,
    label: `${c.tipo === 'ENTRADA' ? 'Entrada' : 'Saída'}: ${c.nome}`
  }))
])
const eventoFiltroOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Todos os eventos' },
  ...eventos.value.map((e) => ({ value: e.id, label: e.nome }))
])

const resultado = computed(
  () =>
    resumo.value.entradas -
    resumo.value.saidas +
    resumo.value.transferenciasEntrada -
    resumo.value.transferenciasSaida
)
const numeroPaginas = computed(() => totalPaginas(itens.value.length, POR_PAGINA))
const itensPagina = computed(() => paginar(itens.value, pagina.value, POR_PAGINA))

let debounce: ReturnType<typeof setTimeout> | null = null
let pedidoAtual = 0

async function carregarLancamentos() {
  const meu = ++pedidoAtual
  carregando.value = true
  erroLista.value = ''
  const { de, ate } = intervaloPreset(filtros.periodo)
  try {
    const r = await listarLancamentosCaixa({
      de,
      ate,
      contaId: filtros.contaId || null,
      categoriaId: filtros.categoriaId || null,
      eventoId: filtros.eventoId || null,
      tipo: (filtros.tipo || null) as TipoLancamento | null,
      busca: filtros.busca,
      incluirCancelados: filtros.incluirCancelados
    })
    if (meu !== pedidoAtual) return
    itens.value = r.itens
    resumo.value = r.resumo
    pagina.value = 1
  } catch {
    if (meu !== pedidoAtual) return
    erroLista.value = 'Não foi possível carregar os lançamentos.'
    itens.value = []
  } finally {
    if (meu === pedidoAtual) carregando.value = false
  }
}

async function recarregarTudo() {
  await Promise.all([carregarContas().catch(() => {}), carregarLancamentos()])
}

watch(
  () => ({ ...filtros }),
  () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(carregarLancamentos, 300)
  }
)

onMounted(async () => {
  await carregarBase()
  await carregarLancamentos()
})

// --- Saldo inicial --------------------------------------------------------
const contaSaldo = ref<ContaCaixa | null>(null)
const salvandoSaldo = ref(false)

async function salvarSaldo(valor: number) {
  if (!contaSaldo.value) return
  salvandoSaldo.value = true
  try {
    await definirSaldoInicialConta(contaSaldo.value.id, valor)
    toast.success(`Saldo de ${contaSaldo.value.nome} salvo.`)
    contaSaldo.value = null
    await recarregarTudo()
  } catch (e) {
    toast.error(mensagemErroCaixa(e))
  } finally {
    salvandoSaldo.value = false
  }
}

// --- Lancamento -----------------------------------------------------------
const modalLancamento = ref(false)
const lancamentoEditado = ref<LancamentoCaixa | null>(null)
const tipoNovo = ref<TipoLancamento>('SAIDA')
const salvandoLancamento = ref(false)

function novoLancamento(tipo: TipoLancamento) {
  lancamentoEditado.value = null
  tipoNovo.value = tipo
  modalLancamento.value = true
}

function editarLancamento(l: LancamentoCaixa) {
  lancamentoEditado.value = l
  modalLancamento.value = true
}

async function salvarLancamento(input: LancamentoInput) {
  salvandoLancamento.value = true
  try {
    await salvarLancamentoCaixa(input)
    toast.success(input.id ? 'Lançamento atualizado.' : 'Lançamento registrado.')
    modalLancamento.value = false
    await recarregarTudo()
  } catch (e) {
    if (e instanceof ErroItensLancamento) {
      // O lancamento entrou; so a lista de itens falhou.
      toast.warning('Lançamento salvo, mas os itens não foram guardados. Abra o lançamento e tente de novo.')
      modalLancamento.value = false
      await recarregarTudo()
    } else {
      toast.error(mensagemErroCaixa(e))
    }
  } finally {
    salvandoLancamento.value = false
  }
}

// --- Fechar bar -----------------------------------------------------------
const modalBar = ref(false)
const salvandoBar = ref(false)

async function salvarBar(input: Parameters<typeof fecharBarCaixa>[0]) {
  salvandoBar.value = true
  try {
    const r = await fecharBarCaixa(input)
    toast.success(`Bar lançado: ${formatMoeda(r.total)}.`)
    modalBar.value = false
    await recarregarTudo()
  } catch (e) {
    toast.error(mensagemErroCaixa(e))
  } finally {
    salvandoBar.value = false
  }
}

// --- Cancelar -------------------------------------------------------------
const lancamentoCancelar = ref<LancamentoCaixa | null>(null)
const cancelando = ref(false)

async function confirmarCancelamento(motivo: string) {
  if (!lancamentoCancelar.value?.lancamentoId) return
  cancelando.value = true
  try {
    await cancelarLancamentoCaixa(lancamentoCancelar.value.lancamentoId, motivo)
    toast.success('Lançamento cancelado.')
    lancamentoCancelar.value = null
    await recarregarTudo()
  } catch (e) {
    toast.error(mensagemErroCaixa(e))
  } finally {
    cancelando.value = false
  }
}

async function abrirComprovante(l: LancamentoCaixa) {
  if (!l.comprovantePath) return
  try {
    window.open(await linkComprovante(l.comprovantePath), '_blank', 'noopener')
  } catch {
    toast.error('Não foi possível abrir o comprovante.')
  }
}

// --- Excel ----------------------------------------------------------------
function baixarExcel() {
  const { de, ate } = intervaloPreset(filtros.periodo)
  const periodo = de && ate ? `${formatarDataCurta(de)} a ${formatarDataCurta(ate)}` : 'Todo o período'
  baixarPlanilhaXlsx(`caixa-galeria-${de ?? 'tudo'}`, {
    aba: 'Lançamentos',
    titulo: 'Galeria Zero 1 - Lançamentos do caixa',
    info: `Período: ${periodo}   •   Entradas: ${formatMoeda(resumo.value.entradas)}   •   Saídas: ${formatMoeda(resumo.value.saidas)}`,
    colunas: COLUNAS_PLANILHA_LANCAMENTOS,
    linhas: linhasPlanilhaLancamentos(itens.value)
  })
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Financeiro" subtitle="O caixa da Galeria Zero 1: tudo o que entra, tudo o que sai e quanto sobra.">
      <template #actions>
        <AppButton variant="primary" @click="novoLancamento('ENTRADA')">
          <PlusIcon class="h-4 w-4" /> Entrada
        </AppButton>
        <AppButton variant="outlineAccent" @click="novoLancamento('SAIDA')">
          <MinusIcon class="h-4 w-4" /> Saída
        </AppButton>
        <AppButton variant="ghost" @click="modalBar = true">
          <BeakerIcon class="h-4 w-4" /> Fechar bar da noite
        </AppButton>
        <AppButton variant="ghost" @click="novoLancamento('TRANSFERENCIA')">
          <ArrowsRightLeftIcon class="h-4 w-4" /> Transferir
        </AppButton>
      </template>
    </PageHeader>

    <FinanceiroAbas />

    <p v-if="erroBase" class="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">
      {{ erroBase }}
    </p>

    <ContasCaixaCards v-else :contas="contas" @informar-saldo="contaSaldo = $event" />

    <section class="space-y-4">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <BaseSelect v-model="filtros.periodo" :options="periodoOptions" />
        <BaseSelect v-model="filtros.tipo" :options="tipoOptions" />
        <BaseSelect v-model="filtros.contaId" :options="contaFiltroOptions" />
        <BaseSelect v-model="filtros.categoriaId" :options="categoriaFiltroOptions" />
        <BaseSelect v-model="filtros.eventoId" :options="eventoFiltroOptions" />
        <div class="sm:col-span-2 lg:col-span-2">
          <BaseInput v-model="filtros.busca" placeholder="Buscar por descrição, categoria ou evento" />
        </div>
        <label class="flex items-center gap-2 text-sm text-zinc-400">
          <input v-model="filtros.incluirCancelados" type="checkbox" class="h-4 w-4 accent-amber-400" />
          Mostrar cancelados
        </label>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
          <p class="text-xs text-zinc-500">Entradas</p>
          <p class="mt-1 text-base font-bold text-emerald-400 sm:text-xl">{{ formatMoeda(resumo.entradas + resumo.transferenciasEntrada) }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
          <p class="text-xs text-zinc-500">Saídas</p>
          <p class="mt-1 text-base font-bold text-red-400 sm:text-xl">{{ formatMoeda(resumo.saidas + resumo.transferenciasSaida) }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
          <p class="text-xs text-zinc-500">Resultado</p>
          <p class="mt-1 text-base font-bold sm:text-xl" :class="resultado < 0 ? 'text-red-400' : 'text-white'">
            {{ formatMoeda(resultado) }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-zinc-500">
          {{ carregando ? 'Carregando...' : `${itens.length} ${itens.length === 1 ? 'lançamento' : 'lançamentos'}` }}
        </p>
        <AppButton variant="ghost" size="sm" :disabled="carregando || itens.length === 0" @click="baixarExcel">
          <ArrowDownTrayIcon class="h-4 w-4" /> Baixar em Excel
        </AppButton>
      </div>

      <p v-if="erroLista" class="text-sm text-red-400">{{ erroLista }}</p>

      <div
        v-else-if="!carregando && itens.length === 0"
        class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500"
      >
        Nenhum lançamento neste período. Use os botões Entrada, Saída ou Fechar bar da noite para
        começar.
      </div>

      <template v-else>
        <LancamentosLista
          :itens="itensPagina"
          @editar="editarLancamento"
          @cancelar="lancamentoCancelar = $event"
          @comprovante="abrirComprovante"
        />
        <BasePagination v-if="numeroPaginas > 1" :pagina="pagina" :total-paginas="numeroPaginas" @ir="pagina = $event" />
      </template>
    </section>

    <SaldoInicialModal
      :open="!!contaSaldo"
      :conta="contaSaldo"
      :salvando="salvandoSaldo"
      @close="contaSaldo = null"
      @submit="salvarSaldo"
    />

    <LancamentoModal
      :open="modalLancamento"
      :lancamento="lancamentoEditado"
      :tipo-inicial="tipoNovo"
      :evento-inicial="filtros.eventoId || null"
      :categorias="categorias"
      :conta-options="contaOptions"
      :evento-options="eventoOptions"
      :salvando="salvandoLancamento"
      @close="modalLancamento = false"
      @submit="salvarLancamento"
    />

    <FecharBarModal
      :open="modalBar"
      :contas="contas"
      :eventos="eventos"
      :evento-options="eventoOptions"
      :salvando="salvandoBar"
      @close="modalBar = false"
      @submit="salvarBar"
    />

    <CancelarLancamentoModal
      :open="!!lancamentoCancelar"
      :lancamento="lancamentoCancelar"
      :salvando="cancelando"
      @close="lancamentoCancelar = null"
      @submit="confirmarCancelamento"
    />
  </div>
</template>
