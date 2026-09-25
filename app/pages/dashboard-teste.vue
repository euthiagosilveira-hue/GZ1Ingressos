<script setup lang="ts">
import type { Component } from 'vue'
import {
  BanknotesIcon,
  ClockIcon,
  CreditCardIcon,
  TicketIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline'

import {
  entriesByHour,
  paymentStatus,
  recentEntries,
  recentOrders,
  todayEvent
} from '~/data/dashboard'

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

definePageMeta({
  title: 'Dashboard',
  description: 'Visão geral do evento de hoje',
  layout: 'dashboard-test-layout'
})

const metrics: Metric[] = [
  {
    icon: TicketIcon,
    label: 'Vendidos',
    value: '347 ingressos',
    subtitle: 'R$ 13.880,00',
    iconClass: 'text-amber-400',
    circleClass: 'border-amber-400/60'
  },
  {
    icon: UserGroupIcon,
    label: 'Utilizados',
    value: '281 ingressos',
    subtitle: '80,98% do total',
    iconClass: 'text-green-500',
    circleClass: 'border-green-500/60',
    subtitleClass: 'text-green-400'
  },
  {
    icon: ClockIcon,
    label: 'Ainda não entraram',
    value: '66 ingressos',
    subtitle: '19,02% do total',
    iconClass: 'text-amber-400',
    circleClass: 'border-amber-400/60'
  },
  {
    icon: BanknotesIcon,
    label: 'Faturamento',
    value: 'R$ 13.880,00',
    subtitle: '100% pagos',
    iconClass: 'text-amber-400',
    circleClass: 'border-amber-400/60',
    subtitleClass: 'text-green-400'
  },
  {
    icon: CreditCardIcon,
    label: 'Ticket médio',
    value: 'R$ 40,00',
    subtitle: 'por ingresso',
    iconClass: 'text-amber-400',
    circleClass: 'border-amber-400/60'
  }
]
</script>

<template>
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
    <TodayEventCard class="lg:col-span-1 xl:col-span-4" :event="todayEvent" />
    <EntriesByHourChart class="lg:col-span-1 xl:col-span-5" :data="entriesByHour" />
    <PaymentStatusChart class="lg:col-span-2 xl:col-span-3" :data="paymentStatus" />
  </div>

  <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
    <RecentOrders class="xl:col-span-8" :orders="recentOrders" />
    <RecentEntries class="xl:col-span-4" :entries="recentEntries" />
  </div>
</template>
