<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import {
  BanknotesIcon,
  ClockIcon,
  CreditCardIcon,
  TicketIcon,
  ChevronDownIcon,
  FunnelIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline'

import SociedadeDashboardCard from '~/components/sociedade/SociedadeDashboardCard.vue'
import { useAdminDashboard } from '~/composables/useAdminDashboard'
import { formatMoeda } from '~/utils/format'
import { rotaDoSeletorFiltro, tituloCardEvento, valorSeletorFiltro } from '~/utils/dashboard'

interface Metric {
  icon: Component
  label: string
  value: string
  subtitle: string
  iconClass?: string
  circleClass?: string
  valueClass?: string
  subtitleClass?: string
}

const { data, viewModel, eventoFiltro, periodoFiltro, carregando } = useAdminDashboard()

const escopo = computed(() => data.value.escopo)

/** Mostra um evento so (evento atual automatico ou escolhido no filtro). */
const umEvento = computed(() => escopo.value.modo === 'atual' || escopo.value.modo === 'evento')

/** Evento cujos numeros estao na tela (para o card de sociedade). */
const eventoDoEscopo = computed(() => {
  if (eventoFiltro.value) return eventoFiltro.value
  if (escopo.value.modo === 'atual') return viewModel.value.evento.eventoId || null
  return null
})

const tituloEvento = computed(() =>
  tituloCardEvento(data.value.evento?.status, escopo.value.modo === 'evento')
)

// ---- Filtro (seletor) ----
const dataCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  timeZone: 'America/Sao_Paulo'
})

function dataEvento(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dataCurta.format(d)
}

const PERIODOS = [
  { value: 'periodo:7', label: 'Últimos 7 dias' },
  { value: 'periodo:15', label: 'Últimos 15 dias' },
  { value: 'periodo:30', label: 'Últimos 30 dias' },
  { value: 'periodo:90', label: 'Últimos 90 dias' },
  { value: 'periodo:todos', label: 'Todos os eventos' }
]

const opcoesEventos = computed(() =>
  data.value.eventos.map((e) => ({
    value: `evento:${e.id}`,
    label: `${dataEvento(e.inicio_em)} · ${e.nome}`
  }))
)

const filtroSelecionado = computed({
  get: () => valorSeletorFiltro(eventoFiltro.value, periodoFiltro.value),
  set: (valor: string) => {
    void navigateTo(rotaDoSeletorFiltro(valor))
  }
})

/** Frase curta abaixo do seletor: o que esta sendo mostrado. */
const resumoEscopo = computed(() => {
  const e = escopo.value
  const qtd = e.quantidadeEventos
  const eventos = qtd === 1 ? '1 evento' : `${qtd} eventos`
  if (e.modo === 'todos') return `Somando ${eventos}`
  if (e.modo === 'periodo') {
    return qtd === 0 ? `Nenhum evento nos últimos ${e.dias} dias` : `Somando ${eventos} dos últimos ${e.dias} dias`
  }
  const ev = data.value.evento
  if (!ev) return 'Nenhum evento cadastrado ainda'
  const quando = dataEvento(ev.inicio_em)
  if (e.modo === 'evento') return `${ev.nome} · ${quando}`
  return `${tituloEvento.value}: ${ev.nome} · ${quando}`
})

const percentualEntrada = computed(() => {
  const m = viewModel.value.metrics
  if (m.vendidos <= 0) return 0
  return Math.round((m.utilizados / m.vendidos) * 100)
})

function percentual(valor: number, total: number): string {
  if (total <= 0) return '0% do total'
  return `${((valor / total) * 100).toFixed(2).replace('.', ',')}% do total`
}

const metrics = computed<Metric[]>(() => {
  const m = viewModel.value.metrics
  return [
    {
      icon: TicketIcon,
      label: 'Vendidos',
      value: `${m.vendidos} ingressos`,
      subtitle: formatMoeda(m.faturamento),
      iconClass: 'text-amber-400',
      circleClass: 'border-amber-400/60'
    },
    {
      icon: UserGroupIcon,
      label: 'Utilizados',
      value: `${m.utilizados} ingressos`,
      subtitle: percentual(m.utilizados, m.vendidos),
      iconClass: 'text-green-500',
      circleClass: 'border-green-500/60',
      subtitleClass: 'text-green-400'
    },
    {
      icon: ClockIcon,
      label: 'Ainda não entraram',
      value: `${m.naoEntraram} ingressos`,
      subtitle: percentual(m.naoEntraram, m.vendidos),
      iconClass: 'text-amber-400',
      circleClass: 'border-amber-400/60'
    },
    {
      icon: BanknotesIcon,
      label: 'Faturamento',
      value: formatMoeda(m.faturamento),
      subtitle: 'Confirmado',
      iconClass: 'text-amber-400',
      circleClass: 'border-amber-400/60',
      subtitleClass: 'text-green-400'
    },
    {
      icon: CreditCardIcon,
      label: 'Ticket médio',
      value: formatMoeda(m.ticketMedio),
      subtitle: 'por ingresso',
      iconClass: 'text-amber-400',
      circleClass: 'border-amber-400/60'
    }
  ]
})
</script>

<template>
  <!-- Filtro: evento atual (padrao), um evento, ultimos N dias ou todos -->
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div class="min-w-0">
      <p class="text-[11px] uppercase tracking-wide text-zinc-500">Mostrando</p>
      <p class="truncate text-sm text-zinc-200">
        <span v-if="carregando" class="text-zinc-500">Carregando…</span>
        <span v-else>{{ resumoEscopo }}</span>
      </p>
    </div>
    <label class="relative block w-full sm:w-72">
      <span class="sr-only">Filtrar dashboard</span>
      <FunnelIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-400" />
      <select
        id="dashboard-filtro"
        v-model="filtroSelecionado"
        class="h-11 w-full cursor-pointer appearance-none rounded-xl border border-zinc-700 bg-zinc-900 pl-9 pr-9 text-sm font-medium text-zinc-100 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40"
      >
        <option value="atual">Evento atual (automático)</option>
        <optgroup label="Período">
          <option v-for="p in PERIODOS" :key="p.value" :value="p.value">{{ p.label }}</option>
        </optgroup>
        <optgroup v-if="opcoesEventos.length" label="Evento">
          <option v-for="ev in opcoesEventos" :key="ev.value" :value="ev.value">{{ ev.label }}</option>
        </optgroup>
      </select>
      <ChevronDownIcon class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
    </label>
  </div>

  <!-- Celular: painel resumo (dinheiro em cima, portaria embaixo) -->
  <div class="flex flex-col gap-3 sm:hidden">
    <BaseCard :padded="false" class="p-4">
      <p class="text-[11px] uppercase tracking-wide text-zinc-400">Faturamento confirmado</p>
      <p class="mt-1 text-[28px] font-bold leading-tight text-white tabular-nums">
        {{ formatMoeda(viewModel.metrics.faturamento) }}
      </p>
      <div class="mt-3 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-3">
        <div>
          <p class="text-[11px] uppercase tracking-wide text-zinc-400">Vendidos</p>
          <p class="mt-0.5 text-lg font-bold text-white tabular-nums">{{ viewModel.metrics.vendidos }}</p>
        </div>
        <div>
          <p class="text-[11px] uppercase tracking-wide text-zinc-400">Ticket médio</p>
          <p class="mt-0.5 text-lg font-bold text-white tabular-nums">{{ formatMoeda(viewModel.metrics.ticketMedio) }}</p>
        </div>
      </div>
    </BaseCard>

    <BaseCard :padded="false" class="p-4">
      <p class="text-[11px] uppercase tracking-wide text-zinc-400">Portaria</p>
      <div
        class="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        :aria-valuenow="percentualEntrada"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-label="Ingressos que já entraram"
      >
        <div class="h-full rounded-full bg-green-500 transition-all" :style="{ width: `${percentualEntrada}%` }" />
      </div>
      <div class="mt-2 flex justify-between text-xs text-zinc-400 tabular-nums">
        <span><span class="font-semibold text-green-400">{{ viewModel.metrics.utilizados }}</span> entraram ({{ percentualEntrada }}%)</span>
        <span><span class="font-semibold text-zinc-100">{{ viewModel.metrics.naoEntraram }}</span> faltam</span>
      </div>
    </BaseCard>
  </div>

  <!-- Tablet/computador: cards como antes -->
  <div class="hidden gap-4 sm:grid sm:grid-cols-2 xl:grid-cols-5">
    <DashboardMetricCard
      v-for="metric in metrics"
      :key="metric.label"
      :icon="metric.icon"
      :label="metric.label"
      :value="metric.value"
      :subtitle="metric.subtitle"
      :icon-class="metric.iconClass"
      :circle-class="metric.circleClass"
      :value-class="metric.valueClass"
      :subtitle-class="metric.subtitleClass"
    />
  </div>

  <SociedadeDashboardCard v-if="eventoDoEscopo" :evento-id="eventoDoEscopo" />

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
    <TodayEventCard
      class="lg:col-span-1 xl:col-span-4"
      :event="viewModel.evento"
      :filtrado="umEvento"
      :titulo="tituloEvento"
    />
    <EntriesByHourChart class="lg:col-span-1 xl:col-span-5" :data="viewModel.entriesByHour" />
    <PaymentStatusChart class="lg:col-span-2 xl:col-span-3" :data="viewModel.paymentStatus" />
  </div>

  <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
    <RecentOrders class="xl:col-span-8" :orders="viewModel.recentOrders" />
    <RecentEntries class="xl:col-span-4" :entries="viewModel.recentEntries" />
  </div>
</template>
