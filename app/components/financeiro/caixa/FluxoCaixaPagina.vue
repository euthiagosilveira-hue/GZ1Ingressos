<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDownTrayIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import FormField from '~/components/FormField.vue'
import PageHeader from '~/components/PageHeader.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import FinanceiroAbas from '~/components/financeiro/caixa/FinanceiroAbas.vue'
import { useCaixaBase } from '~/composables/useCaixaBase'
import { obterFluxoCaixa } from '~/services/admin/caixa'
import type { Agrupamento, FluxoCaixa } from '~/types/caixa'
import type { SelectOption } from '~/types/ui'
import {
  COLUNAS_PLANILHA_FLUXO,
  PRESETS_PERIODO,
  type PresetPeriodo,
  agrupamentoSugerido,
  formatarDataCurta,
  hojeIso,
  intervaloPreset,
  linhasPlanilhaFluxo,
  rotuloPeriodo
} from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'
import { baixarPlanilhaXlsx } from '~/utils/planilhaXlsx'

const { contas, eventos, carregarBase } = useCaixaBase()

const presets = PRESETS_PERIODO.filter((p) => p.value !== 'TUDO')
const filtros = reactive({
  preset: 'ESTE_MES' as PresetPeriodo | 'PERSONALIZADO',
  de: '',
  ate: '',
  agrupamento: 'dia' as Agrupamento,
  contaId: '',
  eventoId: ''
})

const fluxo = ref<FluxoCaixa | null>(null)
const carregando = ref(true)
const erro = ref('')

const presetOptions: SelectOption[] = [
  ...presets.map((p) => ({ value: p.value, label: p.label })),
  { value: 'PERSONALIZADO', label: 'Escolher datas' }
]
const agrupamentoOptions: SelectOption[] = [
  { value: 'dia', label: 'Por dia' },
  { value: 'semana', label: 'Por semana' },
  { value: 'mes', label: 'Por mês' }
]
const contaOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Todas as contas' },
  ...contas.value.map((c) => ({ value: c.id, label: c.nome }))
])
const eventoOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Todos os eventos' },
  ...eventos.value.map((e) => ({ value: e.id, label: e.nome }))
])

function aplicarPreset() {
  if (filtros.preset === 'PERSONALIZADO') return
  const { de, ate } = intervaloPreset(filtros.preset)
  filtros.de = de ?? hojeIso()
  filtros.ate = ate ?? hojeIso()
  filtros.agrupamento = agrupamentoSugerido(filtros.de, filtros.ate)
}

let pedidoAtual = 0
async function carregar() {
  if (!filtros.de || !filtros.ate || filtros.ate < filtros.de) {
    erro.value = 'Escolha um período válido.'
    return
  }
  // Muitos dias por dia fica pesado e ilegivel: troca para semana/mes.
  if (filtros.agrupamento === 'dia' && agrupamentoSugerido(filtros.de, filtros.ate) !== 'dia') {
    filtros.agrupamento = agrupamentoSugerido(filtros.de, filtros.ate)
    return
  }
  const meu = ++pedidoAtual
  carregando.value = true
  erro.value = ''
  try {
    const r = await obterFluxoCaixa({
      de: filtros.de,
      ate: filtros.ate,
      agrupamento: filtros.agrupamento,
      contaId: filtros.contaId || null,
      eventoId: filtros.eventoId || null
    })
    if (meu === pedidoAtual) fluxo.value = r
  } catch {
    if (meu === pedidoAtual) erro.value = 'Não foi possível carregar o fluxo de caixa.'
  } finally {
    if (meu === pedidoAtual) carregando.value = false
  }
}

watch(() => filtros.preset, aplicarPreset)
watch(
  () => [filtros.de, filtros.ate, filtros.agrupamento, filtros.contaId, filtros.eventoId],
  () => carregar()
)

onMounted(async () => {
  aplicarPreset()
  await carregarBase()
})

const periodos = computed(() => fluxo.value?.periodos ?? [])
const maiorBarra = computed(() =>
  Math.max(1, ...periodos.value.map((p) => Math.max(p.entradas, p.saidas)))
)
const resultadoTotal = computed(() => (fluxo.value ? fluxo.value.totais.entradas - fluxo.value.totais.saidas : 0))
const categoriasEntrada = computed(() => (fluxo.value?.porCategoria ?? []).filter((c) => c.tipo === 'ENTRADA'))
const categoriasSaida = computed(() => (fluxo.value?.porCategoria ?? []).filter((c) => c.tipo === 'SAIDA'))
const mostraSaldo = computed(() => !filtros.eventoId)

function altura(valor: number) {
  return `${Math.max(valor > 0 ? 2 : 0, (valor / maiorBarra.value) * 100)}%`
}

function baixarExcel() {
  if (!fluxo.value) return
  const f = fluxo.value
  baixarPlanilhaXlsx(`fluxo-de-caixa-${f.de}-a-${f.ate}`, {
    aba: 'Fluxo de caixa',
    titulo: 'Galeria Zero 1 - Fluxo de caixa',
    info: `Período: ${formatarDataCurta(f.de)} a ${formatarDataCurta(f.ate)}` +
      (f.totais.saldoInicial !== null ? `   •   Saldo no início: ${formatMoeda(f.totais.saldoInicial)}` : ''),
    colunas: COLUNAS_PLANILHA_FLUXO,
    linhas: linhasPlanilhaFluxo(f),
    rodape: ['Total', f.totais.entradas, f.totais.saidas, f.totais.entradas - f.totais.saidas, f.totais.saldoFinal ?? '']
  })
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Financeiro" subtitle="Quanto entrou, quanto saiu e como o saldo andou no período." />

    <FinanceiroAbas />

    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label="Período">
        <BaseSelect v-model="filtros.preset" :options="presetOptions" />
      </FormField>
      <FormField label="Agrupar">
        <BaseSelect v-model="filtros.agrupamento" :options="agrupamentoOptions" />
      </FormField>
      <FormField label="Conta">
        <BaseSelect v-model="filtros.contaId" :options="contaOptions" />
      </FormField>
      <FormField label="Evento">
        <BaseSelect v-model="filtros.eventoId" :options="eventoOptions" />
      </FormField>
      <template v-if="filtros.preset === 'PERSONALIZADO'">
        <FormField label="De">
          <BaseInput v-model="filtros.de" type="date" />
        </FormField>
        <FormField label="Até">
          <BaseInput v-model="filtros.ate" type="date" />
        </FormField>
      </template>
    </section>

    <p v-if="erro" class="text-sm text-red-400">{{ erro }}</p>

    <template v-if="fluxo">
      <section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div v-if="mostraSaldo" class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs text-zinc-500">Saldo no início</p>
          <p class="mt-1 text-xl font-bold text-white">{{ formatMoeda(fluxo.totais.saldoInicial ?? 0) }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs text-zinc-500">Entradas</p>
          <p class="mt-1 text-xl font-bold text-emerald-400">{{ formatMoeda(fluxo.totais.entradas) }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs text-zinc-500">Saídas</p>
          <p class="mt-1 text-xl font-bold text-red-400">{{ formatMoeda(fluxo.totais.saidas) }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs text-zinc-500">{{ mostraSaldo ? 'Saldo no fim' : 'Resultado do evento' }}</p>
          <p
            class="mt-1 text-xl font-bold"
            :class="(mostraSaldo ? fluxo.totais.saldoFinal ?? 0 : resultadoTotal) < 0 ? 'text-red-400' : 'text-white'"
          >
            {{ formatMoeda(mostraSaldo ? fluxo.totais.saldoFinal ?? 0 : resultadoTotal) }}
          </p>
        </div>
      </section>

      <!-- Grafico: entradas x saidas por periodo -->
      <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-zinc-200">Entradas e saídas</h2>
          <div class="flex items-center gap-4 text-xs text-zinc-400">
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Entradas</span>
            <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-red-400" /> Saídas</span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <div class="flex h-48 items-end gap-1" :style="{ minWidth: `${periodos.length * 28}px` }">
            <div
              v-for="p in periodos"
              :key="p.inicio"
              class="group flex h-full min-w-[22px] flex-1 flex-col justify-end"
              :title="`${rotuloPeriodo(p, fluxo.agrupamento)}: entradas ${formatMoeda(p.entradas)}, saídas ${formatMoeda(p.saidas)}`"
            >
              <div class="flex h-full items-end justify-center gap-0.5">
                <div class="w-1/2 max-w-[14px] rounded-t bg-emerald-400/90" :style="{ height: altura(p.entradas) }" />
                <div class="w-1/2 max-w-[14px] rounded-t bg-red-400/90" :style="{ height: altura(p.saidas) }" />
              </div>
            </div>
          </div>
          <div class="mt-1 flex gap-1" :style="{ minWidth: `${periodos.length * 28}px` }">
            <span
              v-for="(p, i) in periodos"
              :key="p.inicio"
              class="min-w-[22px] flex-1 truncate text-center text-[10px] text-zinc-500"
            >
              {{ periodos.length <= 16 || i % Math.ceil(periodos.length / 12) === 0 ? rotuloPeriodo(p, fluxo.agrupamento) : '' }}
            </span>
          </div>
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 class="mb-3 text-sm font-semibold text-zinc-200">Entradas por categoria</h2>
          <p v-if="categoriasEntrada.length === 0" class="text-sm text-zinc-500">Nenhuma entrada no período.</p>
          <ul v-else class="space-y-2">
            <li v-for="c in categoriasEntrada" :key="c.categoriaNome" class="space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-zinc-300">{{ c.categoriaNome }}</span>
                <span class="font-semibold text-emerald-400">{{ formatMoeda(c.total) }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-zinc-800">
                <div class="h-1.5 rounded-full bg-emerald-400/80" :style="{ width: `${(c.total / Math.max(1, fluxo.totais.entradas)) * 100}%` }" />
              </div>
            </li>
          </ul>
        </section>
        <section class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 class="mb-3 text-sm font-semibold text-zinc-200">Saídas por categoria</h2>
          <p v-if="categoriasSaida.length === 0" class="text-sm text-zinc-500">Nenhuma saída no período.</p>
          <ul v-else class="space-y-2">
            <li v-for="c in categoriasSaida" :key="c.categoriaNome" class="space-y-1">
              <div class="flex justify-between text-sm">
                <span class="text-zinc-300">{{ c.categoriaNome }}</span>
                <span class="font-semibold text-red-400">{{ formatMoeda(c.total) }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-zinc-800">
                <div class="h-1.5 rounded-full bg-red-400/80" :style="{ width: `${(c.total / Math.max(1, fluxo.totais.saidas)) * 100}%` }" />
              </div>
            </li>
          </ul>
        </section>
      </div>

      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-semibold text-zinc-200">Período a período</h2>
          <AppButton variant="ghost" size="sm" :disabled="carregando" @click="baixarExcel">
            <ArrowDownTrayIcon class="h-4 w-4" /> Baixar em Excel
          </AppButton>
        </div>
        <div class="overflow-x-auto rounded-xl border border-zinc-800">
          <table class="w-full text-left text-sm">
            <thead class="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th class="px-4 py-3 font-semibold">Período</th>
                <th class="px-4 py-3 text-right font-semibold">Entradas</th>
                <th class="px-4 py-3 text-right font-semibold">Saídas</th>
                <th class="px-4 py-3 text-right font-semibold">Resultado</th>
                <th v-if="mostraSaldo" class="px-4 py-3 text-right font-semibold">Saldo no fim</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-zinc-800 bg-zinc-950/40">
              <tr v-for="p in [...periodos].reverse()" :key="p.inicio">
                <td class="whitespace-nowrap px-4 py-2.5 text-zinc-300">
                  {{ p.inicio === p.fim ? formatarDataCurta(p.inicio) : `${formatarDataCurta(p.inicio)} a ${formatarDataCurta(p.fim)}` }}
                </td>
                <td class="whitespace-nowrap px-4 py-2.5 text-right text-emerald-400">{{ formatMoeda(p.entradas) }}</td>
                <td class="whitespace-nowrap px-4 py-2.5 text-right text-red-400">{{ formatMoeda(p.saidas) }}</td>
                <td class="whitespace-nowrap px-4 py-2.5 text-right font-semibold" :class="p.resultado < 0 ? 'text-red-400' : 'text-white'">
                  {{ formatMoeda(p.resultado) }}
                </td>
                <td v-if="mostraSaldo" class="whitespace-nowrap px-4 py-2.5 text-right text-zinc-300">{{ formatMoeda(p.saldo ?? 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <p v-else-if="carregando && !erro" class="text-sm text-zinc-500">Carregando...</p>
  </div>
</template>
