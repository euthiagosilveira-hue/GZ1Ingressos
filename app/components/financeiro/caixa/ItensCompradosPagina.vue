<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDownTrayIcon, MagnifyingGlassIcon, PaperClipIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import FormField from '~/components/FormField.vue'
import PageHeader from '~/components/PageHeader.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import FinanceiroAbas from '~/components/financeiro/caixa/FinanceiroAbas.vue'
import { linkComprovante, listarHistoricoItens } from '~/services/admin/caixa'
import type { HistoricoItens } from '~/types/caixa'
import type { SelectOption } from '~/types/ui'
import {
  PRESETS_PERIODO,
  type PresetPeriodo,
  formatarDataCurta,
  formatarQuantidade,
  intervaloPreset
} from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'
import { baixarPlanilhaXlsx } from '~/utils/planilhaXlsx'

// Historico dos produtos lidos dos comprovantes: quanto se comprou de cada
// coisa, por quanto, e quando foi a ultima compra.

const filtros = reactive({
  preset: 'TRINTA_DIAS' as PresetPeriodo | 'PERSONALIZADO',
  de: '' as string,
  ate: '' as string,
  busca: ''
})
const visao = ref<'produtos' | 'compras'>('produtos')

const historico = ref<HistoricoItens | null>(null)
const carregando = ref(true)
const erro = ref('')

const presetOptions: SelectOption[] = [
  ...PRESETS_PERIODO.map((p) => ({ value: p.value, label: p.label })),
  { value: 'PERSONALIZADO', label: 'Escolher datas' }
]
const visaoOptions: SelectOption[] = [
  { value: 'produtos', label: 'Por produto' },
  { value: 'compras', label: 'Cada compra' }
]

function aplicarPreset() {
  if (filtros.preset === 'PERSONALIZADO') return
  const { de, ate } = intervaloPreset(filtros.preset)
  filtros.de = de ?? ''
  filtros.ate = ate ?? ''
}

let pedidoAtual = 0
let espera: ReturnType<typeof setTimeout> | undefined
async function carregar() {
  const meu = ++pedidoAtual
  carregando.value = true
  erro.value = ''
  try {
    const r = await listarHistoricoItens({ de: filtros.de || null, ate: filtros.ate || null, busca: filtros.busca })
    if (meu === pedidoAtual) historico.value = r
  } catch {
    if (meu === pedidoAtual) erro.value = 'Não foi possível carregar os itens.'
  } finally {
    if (meu === pedidoAtual) carregando.value = false
  }
}

watch(() => filtros.preset, aplicarPreset)
watch(() => [filtros.de, filtros.ate], () => carregar())
watch(
  () => filtros.busca,
  () => {
    clearTimeout(espera)
    espera = setTimeout(carregar, 350)
  }
)

onMounted(() => {
  aplicarPreset()
  void carregar()
})

const produtos = computed(() => historico.value?.produtos ?? [])
const itens = computed(() => historico.value?.itens ?? [])

function variacao(menor: number | null, maior: number | null): string {
  if (menor === null || maior === null || menor === maior) return ''
  return `${formatMoeda(menor)} a ${formatMoeda(maior)}`
}

async function abrirComprovante(caminho: string) {
  try {
    window.open(await linkComprovante(caminho), '_blank', 'noopener')
  } catch {
    erro.value = 'Não foi possível abrir o comprovante.'
  }
}

function baixarExcel() {
  if (!historico.value) return
  const periodo =
    filtros.de || filtros.ate
      ? `Período: ${filtros.de ? formatarDataCurta(filtros.de) : 'início'} a ${filtros.ate ? formatarDataCurta(filtros.ate) : 'hoje'}`
      : 'Período: tudo'
  if (visao.value === 'produtos') {
    baixarPlanilhaXlsx('itens-comprados-por-produto', {
      aba: 'Por produto',
      titulo: 'Galeria Zero 1 - Itens comprados por produto',
      info: periodo,
      colunas: [
        { titulo: 'Produto', largura: 36 },
        { titulo: 'Compras', largura: 10 },
        { titulo: 'Quantidade', largura: 12 },
        { titulo: 'Total (R$)', largura: 14, moeda: true },
        { titulo: 'Preço médio (R$)', largura: 16, moeda: true },
        { titulo: 'Último preço (R$)', largura: 16, moeda: true },
        { titulo: 'Última compra', largura: 14 }
      ],
      linhas: produtos.value.map((p) => [
        p.descricao,
        p.compras,
        p.quantidade,
        p.valorTotal,
        p.precoMedio ?? '',
        p.ultimoPreco ?? '',
        p.ultimaData ? formatarDataCurta(p.ultimaData) : ''
      ]),
      rodape: ['Total', '', '', historico.value.totais.valorTotal, '', '', '']
    })
  } else {
    baixarPlanilhaXlsx('itens-comprados', {
      aba: 'Itens',
      titulo: 'Galeria Zero 1 - Itens comprados',
      info: periodo,
      colunas: [
        { titulo: 'Data', largura: 12 },
        { titulo: 'Produto', largura: 36 },
        { titulo: 'Quantidade', largura: 12 },
        { titulo: 'Preço unitário (R$)', largura: 16, moeda: true },
        { titulo: 'Total (R$)', largura: 14, moeda: true },
        { titulo: 'Lançamento', largura: 36 },
        { titulo: 'Categoria', largura: 20 },
        { titulo: 'Evento', largura: 26 }
      ],
      linhas: itens.value.map((i) => [
        formatarDataCurta(i.data),
        i.descricao,
        i.quantidade,
        i.valorUnitario ?? '',
        i.valorTotal,
        i.lancamentoDescricao ?? '',
        i.categoriaNome ?? '',
        i.eventoNome ?? ''
      ]),
      rodape: ['Total', '', '', '', historico.value.totais.valorTotal, '', '', '']
    })
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Financeiro" subtitle="Tudo o que foi comprado, item por item, lido dos comprovantes." />

    <FinanceiroAbas />

    <div class="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <FormField label="Período">
        <BaseSelect v-model="filtros.preset" :options="presetOptions" />
      </FormField>
      <template v-if="filtros.preset === 'PERSONALIZADO'">
        <FormField label="De">
          <BaseInput v-model="filtros.de" type="date" />
        </FormField>
        <FormField label="Até">
          <BaseInput v-model="filtros.ate" type="date" />
        </FormField>
      </template>
      <FormField label="Buscar produto" :class="filtros.preset === 'PERSONALIZADO' ? '' : 'lg:col-span-3'">
        <div class="relative">
          <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            v-model="filtros.busca"
            type="search"
            placeholder="Ex.: Red Label, Coca"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
        </div>
      </FormField>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <SegmentedControl v-model="visao" :options="visaoOptions" />
      <div class="flex items-center gap-4">
        <p v-if="historico" class="text-sm text-zinc-400">
          {{ historico.totais.itens }} {{ historico.totais.itens === 1 ? 'item' : 'itens' }} ·
          <span class="font-semibold text-white">{{ formatMoeda(historico.totais.valorTotal) }}</span>
        </p>
        <AppButton variant="outline" size="sm" :disabled="!historico || !historico.totais.itens" @click="baixarExcel">
          <ArrowDownTrayIcon class="h-4 w-4" /> Excel
        </AppButton>
      </div>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{{ erro }}</p>

    <div v-if="carregando && !historico" class="flex items-center gap-3 p-6 text-sm text-zinc-400">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" aria-hidden="true" />
      Carregando...
    </div>

    <div
      v-else-if="historico && !historico.totais.itens"
      class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400"
    >
      Nenhum item neste período.
      <span class="mt-1 block text-xs text-zinc-500">
        Ao lançar uma saída com comprovante de compra, a IA lê os produtos e eles aparecem aqui.
      </span>
    </div>

    <template v-else-if="historico">
      <!-- Por produto -->
      <div v-if="visao === 'produtos'" class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900" :class="carregando ? 'opacity-60' : ''">
        <table class="hidden w-full text-sm md:table">
          <thead class="border-b border-zinc-800 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th class="px-4 py-3 font-medium">Produto</th>
              <th class="px-4 py-3 text-right font-medium">Qtd.</th>
              <th class="px-4 py-3 text-right font-medium">Total</th>
              <th class="px-4 py-3 text-right font-medium">Preço médio</th>
              <th class="px-4 py-3 text-right font-medium">Último preço</th>
              <th class="px-4 py-3 text-right font-medium">Última compra</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr v-for="p in produtos" :key="p.descricao">
              <td class="px-4 py-3 text-zinc-100">
                {{ p.descricao }}
                <span class="block text-xs text-zinc-500">
                  {{ p.compras }} {{ p.compras === 1 ? 'compra' : 'compras' }}
                  <template v-if="variacao(p.menorPreco, p.maiorPreco)"> · preço de {{ variacao(p.menorPreco, p.maiorPreco) }}</template>
                </span>
              </td>
              <td class="px-4 py-3 text-right text-zinc-300">{{ formatarQuantidade(p.quantidade) }}</td>
              <td class="px-4 py-3 text-right font-semibold text-white">{{ formatMoeda(p.valorTotal) }}</td>
              <td class="px-4 py-3 text-right text-zinc-300">{{ p.precoMedio !== null ? formatMoeda(p.precoMedio) : '—' }}</td>
              <td class="px-4 py-3 text-right text-zinc-300">{{ p.ultimoPreco !== null ? formatMoeda(p.ultimoPreco) : '—' }}</td>
              <td class="px-4 py-3 text-right text-zinc-400">{{ p.ultimaData ? formatarDataCurta(p.ultimaData) : '—' }}</td>
            </tr>
          </tbody>
        </table>
        <ul class="divide-y divide-zinc-800 md:hidden">
          <li v-for="p in produtos" :key="p.descricao" class="space-y-1 p-4">
            <div class="flex items-start justify-between gap-3">
              <p class="min-w-0 font-medium text-zinc-100">{{ p.descricao }}</p>
              <p class="shrink-0 font-semibold text-white">{{ formatMoeda(p.valorTotal) }}</p>
            </div>
            <p class="text-xs text-zinc-400">
              {{ formatarQuantidade(p.quantidade) }} un. em {{ p.compras }} {{ p.compras === 1 ? 'compra' : 'compras' }}
              <template v-if="p.precoMedio !== null"> · média {{ formatMoeda(p.precoMedio) }}</template>
            </p>
            <p class="text-xs text-zinc-500">
              <template v-if="p.ultimoPreco !== null">Último preço {{ formatMoeda(p.ultimoPreco) }}</template>
              <template v-if="p.ultimaData"> em {{ formatarDataCurta(p.ultimaData) }}</template>
            </p>
          </li>
        </ul>
      </div>

      <!-- Cada compra -->
      <div v-else class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900" :class="carregando ? 'opacity-60' : ''">
        <ul class="divide-y divide-zinc-800">
          <li v-for="i in itens" :key="i.id" class="flex items-start gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="text-zinc-100">
                <span class="text-zinc-400">{{ formatarQuantidade(i.quantidade) }}x</span> {{ i.descricao }}
              </p>
              <p class="text-xs text-zinc-500">
                {{ formatarDataCurta(i.data) }}
                <template v-if="i.lancamentoDescricao"> · {{ i.lancamentoDescricao }}</template>
                <template v-if="i.eventoNome"> · {{ i.eventoNome }}</template>
              </p>
            </div>
            <div class="shrink-0 text-right">
              <p class="font-semibold text-white">{{ formatMoeda(i.valorTotal) }}</p>
              <p v-if="i.valorUnitario !== null && i.quantidade !== 1" class="text-xs text-zinc-500">
                {{ formatMoeda(i.valorUnitario) }} cada
              </p>
            </div>
            <button
              v-if="i.comprovantePath"
              type="button"
              title="Ver comprovante"
              aria-label="Ver comprovante"
              class="shrink-0 cursor-pointer rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-amber-400"
              @click="abrirComprovante(i.comprovantePath)"
            >
              <PaperClipIcon class="h-4 w-4" />
            </button>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
