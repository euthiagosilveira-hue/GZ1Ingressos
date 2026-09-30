<script setup lang="ts">
import { computed } from 'vue'
import {
  BanknotesIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  CreditCardIcon,
  EyeIcon,
  MapPinIcon,
  TicketIcon,
  UserGroupIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'
import StatCard from '~/components/StatCard.vue'
import StatusBadge from '~/components/StatusBadge.vue'
import { useAdminDashboard } from '~/composables/useAdminDashboard'
import { formatHora, formatMoeda, formatNumero } from '~/utils/format'

definePageMeta({
  title: 'Dashboard',
  description: 'Visão geral do evento de hoje',
  layout: 'dashboard-layout',
  middleware: ['admin-auth']
})

const { viewModel, data } = useAdminDashboard()

const m = computed(() => viewModel.value.metrics)

function pct(valor: number, total: number): string {
  if (total <= 0) return '0% do total'
  return `${((valor / total) * 100).toFixed(2).replace('.', ',')}% do total`
}

const statCards = computed(() => [
  {
    icon: TicketIcon,
    label: 'Vendidos',
    value: formatNumero(m.value.vendidos),
    subtitle: formatMoeda(m.value.faturamento),
    accent: true
  },
  {
    icon: UserGroupIcon,
    label: 'Utilizados',
    value: formatNumero(m.value.utilizados),
    subtitle: pct(m.value.utilizados, m.value.vendidos),
    accent: false
  },
  {
    icon: ClockIcon,
    label: 'Ainda não entraram',
    value: formatNumero(m.value.naoEntraram),
    subtitle: pct(m.value.naoEntraram, m.value.vendidos),
    accent: false
  },
  {
    icon: BanknotesIcon,
    label: 'Faturamento',
    value: formatMoeda(m.value.faturamento),
    subtitle: 'Confirmado',
    accent: false
  },
  {
    icon: CreditCardIcon,
    label: 'Ticket médio',
    value: formatMoeda(m.value.ticketMedio),
    subtitle: 'por ingresso',
    accent: false
  }
])

// Gráfico (mesma geometria/classes da versão anterior).
const maxHora = computed(() => {
  const valores = viewModel.value.entriesByHour.map((p) => p.entradas)
  return Math.max(10, Math.ceil(Math.max(...valores, 0) / 10) * 10)
})

const pontos = computed(() =>
  viewModel.value.entriesByHour.map((ponto, i) => ({
    x: 10 + 30 * i,
    y: 20 + 90 * (1 - ponto.entradas / (maxHora.value || 1)),
    entrada: ponto.entradas,
    hora: ponto.hora
  }))
)

const linePath = computed(() =>
  pontos.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
)

const areaPath = computed(() => {
  const lista = pontos.value
  if (lista.length === 0) return ''
  const first = lista[0]
  const last = lista[lista.length - 1]
  if (!first || !last) return ''
  return `${linePath.value} L${last.x},130 L${first.x},130 Z`
})

const pontoMax = computed(() => {
  if (pontos.value.length === 0) return null
  return pontos.value.reduce((maior, atual) => (atual.entrada > maior.entrada ? atual : maior))
})

// Donut de pagamentos.
const slices = computed(() => viewModel.value.paymentStatus)
const totalPag = computed(() => slices.value.reduce((soma, s) => soma + s.value, 0))

const gradientPag = computed(() => {
  let acc = 0
  const stops = slices.value.map((slice) => {
    const start = acc
    const percent = totalPag.value ? (slice.value / totalPag.value) * 100 : 0
    acc += percent
    return `${slice.color} ${start}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
})

function percentualPag(valor: number): string {
  const percent = totalPag.value ? (valor / totalPag.value) * 100 : 0
  return `${percent.toFixed(1).replace('.', ',')}%`
}

function abrirPedido(pedidoId: string) {
  navigateTo(`/pedidos/${pedidoId}`)
}
</script>

<template>
  <!-- Stat cards -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <StatCard
      v-for="card in statCards"
      :key="card.label"
      :icon="card.icon"
      :label="card.label"
      :value="card.value"
      :subtitle="card.subtitle"
      :accent="card.accent"
    />
  </div>

  <!-- Middle row -->
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
    <!-- Evento de hoje -->
    <BaseCard class="xl:col-span-4">
      <div class="flex h-full flex-col">
        <div class="grid grid-cols-2 gap-3">
          <div
            class="flex items-center justify-center rounded-xl bg-gradient-to-b from-zinc-700 to-zinc-900 p-4"
          >
            <div class="text-center">
              <p class="text-lg font-bold text-amber-400">{{ viewModel.evento.poster.weekday }}</p>
              <p class="text-4xl font-black leading-none text-white">{{ viewModel.evento.poster.day }}</p>
              <p class="mt-1 text-sm tracking-widest text-zinc-400">{{ viewModel.evento.poster.month }}</p>
            </div>
          </div>
          <div class="flex flex-col justify-center gap-2">
            <span
              class="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-zinc-950"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-red-600"></span>
              {{ viewModel.evento.badge }}
            </span>
            <p class="text-sm font-bold text-white">{{ viewModel.evento.title }}</p>
          </div>
        </div>

        <div class="mt-4 space-y-2 text-sm text-zinc-300">
          <div class="flex items-center gap-2">
            <CalendarDaysIcon class="h-4 w-4 text-zinc-500" />
            {{ viewModel.evento.date }}
          </div>
          <div class="flex items-center gap-2">
            <ClockIcon class="h-4 w-4 text-zinc-500" />
            {{ viewModel.evento.time }}
          </div>
          <div class="flex items-center gap-2">
            <MapPinIcon class="h-4 w-4 text-zinc-500" />
            {{ viewModel.evento.venue }}
          </div>
        </div>

        <div class="mt-auto pt-4">
          <AppButton variant="outline" block>Ver evento</AppButton>
        </div>
      </div>
    </BaseCard>

    <!-- Entradas por hora -->
    <BaseCard class="xl:col-span-5">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-white">Entradas por hora</h3>
        <div
          class="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300"
        >
          Hoje
          <ChevronDownIcon class="h-4 w-4 text-zinc-500" />
        </div>
      </div>

      <div class="mt-4">
        <svg viewBox="0 0 320 130" class="w-full">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.4" />
              <stop offset="100%" stop-color="#fbbf24" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line x1="10" y1="20" x2="310" y2="20" stroke="#27272a" />
          <line x1="10" y1="60" x2="310" y2="60" stroke="#27272a" />
          <line x1="10" y1="100" x2="310" y2="100" stroke="#27272a" />
          <path :d="areaPath" fill="url(#areaGrad)" />
          <polyline
            :points="pontos.map((p) => `${p.x},${p.y}`).join(' ')"
            fill="none"
            stroke="#fbbf24"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle v-if="pontoMax" :cx="pontoMax.x" :cy="pontoMax.y" r="4" fill="#fbbf24" />
        </svg>
        <div class="mt-2 flex justify-between text-[10px] text-zinc-500">
          <span v-for="ponto in pontos" :key="ponto.hora">{{ ponto.hora }}</span>
        </div>
      </div>
    </BaseCard>

    <!-- Status dos pagamentos -->
    <BaseCard class="xl:col-span-3">
      <h3 class="font-semibold text-white">Status dos pagamentos</h3>
      <div class="mt-4 flex justify-center">
        <div class="relative h-40 w-40 rounded-full" :style="{ background: gradientPag }">
          <div class="absolute inset-5 flex items-center justify-center rounded-full bg-zinc-900">
            <span class="text-sm font-bold text-white">100%</span>
          </div>
        </div>
      </div>
      <div class="mt-4 space-y-2 text-sm">
        <div v-for="slice in slices" :key="slice.key" class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: slice.color }"></span>
          <span class="flex-1 text-zinc-300">{{ slice.label }}</span>
          <span class="text-white">{{ slice.value }} ({{ percentualPag(slice.value) }})</span>
        </div>
      </div>
    </BaseCard>
  </div>

  <!-- Bottom row -->
  <div class="grid grid-cols-1 gap-4 xl:grid-cols-12">
    <!-- Últimos pedidos -->
    <BaseCard class="xl:col-span-8">
      <h3 class="font-semibold text-white">ÚLTIMOS PEDIDOS</h3>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead>
            <tr class="text-xs uppercase tracking-wide text-zinc-500">
              <th class="pb-3 pr-4 font-medium">Pedido</th>
              <th class="pb-3 pr-4 font-medium">Comprador</th>
              <th class="pb-3 pr-4 font-medium">Ingressos</th>
              <th class="pb-3 pr-4 font-medium">Total</th>
              <th class="pb-3 pr-4 font-medium">Pagamento</th>
              <th class="pb-3 pr-4 font-medium">Entrada</th>
              <th class="pb-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-zinc-800">
            <tr v-for="pedido in data.pedidosRecentes" :key="pedido.pedido_id">
              <td class="py-3 pr-4 text-zinc-300">#{{ pedido.codigo }}</td>
              <td class="py-3 pr-4 font-semibold text-white">{{ pedido.buyer }}</td>
              <td class="py-3 pr-4 text-zinc-300">{{ pedido.tickets }}</td>
              <td class="py-3 pr-4 text-zinc-300">{{ formatMoeda(Number(pedido.total)) }}</td>
              <td class="py-3 pr-4">
                <StatusBadge
                  :status="pedido.status === 'PAGO' ? 'success' : 'warning'"
                  :label="pedido.status === 'PAGO' ? 'Pago' : 'Pendente'"
                />
              </td>
              <td class="py-3 pr-4 text-zinc-300">{{ pedido.entrance_used }}/{{ pedido.tickets }}</td>
              <td class="py-3">
                <button
                  class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  @click="abrirPedido(pedido.pedido_id)"
                >
                  <EyeIcon class="h-4 w-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="mt-4 flex justify-center">
        <AppButton variant="outline">Ver todos os pedidos</AppButton>
      </div>
    </BaseCard>

    <!-- Acessos recentes -->
    <BaseCard class="xl:col-span-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-white">ACESSOS RECENTES (PORTARIA)</h3>
        <span class="text-xs text-amber-400">Ver todos</span>
      </div>
      <div class="mt-4 space-y-3">
        <div v-for="entrada in data.entradasRecentes" :key="entrada.id" class="flex items-center gap-3">
          <CheckCircleIcon class="h-4 w-4 shrink-0 text-green-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">{{ entrada.name }}</p>
            <p class="text-xs text-zinc-500">Ingresso {{ entrada.codigo }}</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-zinc-300">{{ formatHora(entrada.entrada_em) }}</p>
            <p class="text-xs text-zinc-500">Hoje</p>
          </div>
        </div>
      </div>
      <div class="mt-4 flex justify-center">
        <AppButton variant="outline">Ver todas as entradas</AppButton>
      </div>
    </BaseCard>
  </div>
</template>
