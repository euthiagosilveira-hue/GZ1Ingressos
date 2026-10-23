<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import {
  BanknotesIcon,
  ClockIcon,
  CreditCardIcon,
  TicketIcon,
  UserGroupIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'

import { useAdminDashboard } from '~/composables/useAdminDashboard'
import { formatMoeda } from '~/utils/format'

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

const { viewModel, eventoFiltro } = useAdminDashboard()

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
  <!-- Aviso do filtro por evento (vem do botao "Ver evento") -->
  <div
    v-if="eventoFiltro"
    class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm"
  >
    <p class="text-zinc-200">
      Mostrando somente os dados de
      <span class="font-semibold text-amber-400">{{ viewModel.evento.hasEvent ? viewModel.evento.title : 'evento selecionado' }}</span>
    </p>
    <NuxtLink
      to="/"
      class="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-amber-400 hover:text-amber-300"
    >
      <XMarkIcon class="h-4 w-4" />
      Limpar filtro
    </NuxtLink>
  </div>

  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
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

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
    <TodayEventCard
      class="lg:col-span-1 xl:col-span-4"
      :event="viewModel.evento"
      :filtrado="Boolean(eventoFiltro)"
    />
    <EntriesByHourChart class="lg:col-span-1 xl:col-span-5" :data="viewModel.entriesByHour" />
    <PaymentStatusChart class="lg:col-span-2 xl:col-span-3" :data="viewModel.paymentStatus" />
  </div>

  <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
    <RecentOrders class="xl:col-span-8" :orders="viewModel.recentOrders" />
    <RecentEntries class="xl:col-span-4" :entries="viewModel.recentEntries" />
  </div>
</template>
