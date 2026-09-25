<script setup lang="ts">
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
  UserGroupIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'
import StatCard from '~/components/StatCard.vue'
import StatusBadge from '~/components/StatusBadge.vue'

definePageMeta({
  title: 'Dashboard',
  description: 'Visão geral do evento de hoje',
  layout: 'dashboard-layout'
})
</script>

<template>
  <!-- Stat cards -->
  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
    <StatCard :icon="TicketIcon" label="Vendidos" value="347" subtitle="R$ 13.880,00" accent />
    <StatCard :icon="UserGroupIcon" label="Utilizados" value="281" subtitle="80,99% do total" />
    <StatCard
      :icon="ClockIcon"
      label="Ainda não entraram"
      value="66"
      subtitle="19,02% do total"
    />
    <StatCard
      :icon="BanknotesIcon"
      label="Faturamento"
      value="R$ 13.880,00"
      subtitle="100% pagos"
    />
    <StatCard :icon="CreditCardIcon" label="Ticket médio" value="R$ 40,00" subtitle="por ingresso" />
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
              <p class="text-lg font-bold text-amber-400">SÁB</p>
              <p class="text-4xl font-black leading-none text-white">29</p>
              <p class="mt-1 text-sm tracking-widest text-zinc-400">AGO</p>
            </div>
          </div>
          <div class="flex flex-col justify-center gap-2">
            <span
              class="inline-flex w-fit items-center gap-1.5 rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-semibold text-zinc-950"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-red-600"></span>
              AO VIVO
            </span>
            <p class="text-sm font-bold text-white">Banda Conexão</p>
          </div>
        </div>

        <div class="mt-4 space-y-2 text-sm text-zinc-300">
          <div class="flex items-center gap-2">
            <CalendarDaysIcon class="h-4 w-4 text-zinc-500" />
            Sábado, 29 de Agosto
          </div>
          <div class="flex items-center gap-2">
            <ClockIcon class="h-4 w-4 text-zinc-500" />
            22:00
          </div>
          <div class="flex items-center gap-2">
            <MapPinIcon class="h-4 w-4 text-zinc-500" />
            Galeria Zero 1
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
          <path
            d="M10,103.75 L40,100 L70,95 L100,87.5 L130,70 L160,51.25 L190,31.25 L220,37.5 L250,65 L280,90 L310,102.5 L310,130 L10,130 Z"
            fill="url(#areaGrad)"
          />
          <polyline
            points="10,103.75 40,100 70,95 100,87.5 130,70 160,51.25 190,31.25 220,37.5 250,65 280,90 310,102.5"
            fill="none"
            stroke="#fbbf24"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <circle cx="190" cy="31.25" r="4" fill="#fbbf24" />
        </svg>
        <div class="mt-2 flex justify-between text-[10px] text-zinc-500">
          <span>18h</span>
          <span>19h</span>
          <span>20h</span>
          <span>21h</span>
          <span>22h</span>
          <span>23h</span>
          <span>00h</span>
          <span>01h</span>
          <span>02h</span>
          <span>03h</span>
          <span>04h</span>
        </div>
      </div>
    </BaseCard>

    <!-- Status dos pagamentos -->
    <BaseCard class="xl:col-span-3">
      <h3 class="font-semibold text-white">Status dos pagamentos</h3>
      <div class="mt-4 flex justify-center">
        <div
          class="relative h-40 w-40 rounded-full"
          style="background: conic-gradient(#22c55e 0% 93.9%, #f59e0b 93.9% 98.2%, #ef4444 98.2% 100%)"
        >
          <div class="absolute inset-5 flex items-center justify-center rounded-full bg-zinc-900">
            <span class="text-sm font-bold text-white">100%</span>
          </div>
        </div>
      </div>
      <div class="mt-4 space-y-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-green-500"></span>
          <span class="flex-1 text-zinc-300">Pago</span>
          <span class="text-white">326 (93,9%)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-amber-400"></span>
          <span class="flex-1 text-zinc-300">Pendente</span>
          <span class="text-white">15 (4,3%)</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-full bg-red-500"></span>
          <span class="flex-1 text-zinc-300">Cancelado</span>
          <span class="text-white">6 (1,8%)</span>
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
            <tr>
              <td class="py-3 pr-4 text-zinc-300">#GZ102458</td>
              <td class="py-3 pr-4 font-semibold text-white">João da Silva</td>
              <td class="py-3 pr-4 text-zinc-300">4</td>
              <td class="py-3 pr-4 text-zinc-300">R$ 160,00</td>
              <td class="py-3 pr-4"><StatusBadge status="success" label="Pago" /></td>
              <td class="py-3 pr-4 text-zinc-300">2/4</td>
              <td class="py-3">
                <button class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                  <EyeIcon class="h-4 w-4" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="py-3 pr-4 text-zinc-300">#GZ102457</td>
              <td class="py-3 pr-4 font-semibold text-white">Maria Oliveira</td>
              <td class="py-3 pr-4 text-zinc-300">3</td>
              <td class="py-3 pr-4 text-zinc-300">R$ 80,00</td>
              <td class="py-3 pr-4"><StatusBadge status="success" label="Pago" /></td>
              <td class="py-3 pr-4 text-zinc-300">2/2</td>
              <td class="py-3">
                <button class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                  <EyeIcon class="h-4 w-4" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="py-3 pr-4 text-zinc-300">#GZ102456</td>
              <td class="py-3 pr-4 font-semibold text-white">Carlos Santos</td>
              <td class="py-3 pr-4 text-zinc-300">3</td>
              <td class="py-3 pr-4 text-zinc-300">R$ 120,00</td>
              <td class="py-3 pr-4"><StatusBadge status="success" label="Pago" /></td>
              <td class="py-3 pr-4 text-zinc-300">1/3</td>
              <td class="py-3">
                <button class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                  <EyeIcon class="h-4 w-4" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="py-3 pr-4 text-zinc-300">#GZ102455</td>
              <td class="py-3 pr-4 font-semibold text-white">Pedro Souza</td>
              <td class="py-3 pr-4 text-zinc-300">1</td>
              <td class="py-3 pr-4 text-zinc-300">R$ 40,00</td>
              <td class="py-3 pr-4"><StatusBadge status="warning" label="Pendente" /></td>
              <td class="py-3 pr-4 text-zinc-300">0/1</td>
              <td class="py-3">
                <button class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                  <EyeIcon class="h-4 w-4" />
                </button>
              </td>
            </tr>
            <tr>
              <td class="py-3 pr-4 text-zinc-300">#GZ102454</td>
              <td class="py-3 pr-4 font-semibold text-white">Ana Paula Lima</td>
              <td class="py-3 pr-4 text-zinc-300">2</td>
              <td class="py-3 pr-4 text-zinc-300">R$ 80,00</td>
              <td class="py-3 pr-4"><StatusBadge status="success" label="Pago" /></td>
              <td class="py-3 pr-4 text-zinc-300">2/2</td>
              <td class="py-3">
                <button class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white">
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
        <div class="flex items-center gap-3">
          <CheckCircleIcon class="h-4 w-4 shrink-0 text-green-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">Maria Oliveira</p>
            <p class="text-xs text-zinc-500">Ingresso #02</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-zinc-300">22:47</p>
            <p class="text-xs text-zinc-500">Hoje</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <CheckCircleIcon class="h-4 w-4 shrink-0 text-green-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">João da Silva</p>
            <p class="text-xs text-zinc-500">Ingresso #01</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-zinc-300">22:45</p>
            <p class="text-xs text-zinc-500">Hoje</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <CheckCircleIcon class="h-4 w-4 shrink-0 text-green-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">Carlos Santos</p>
            <p class="text-xs text-zinc-500">Ingresso #01</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-zinc-300">22:43</p>
            <p class="text-xs text-zinc-500">Hoje</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <XCircleIcon class="h-4 w-4 shrink-0 text-red-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">Maria Oliveira</p>
            <p class="text-xs text-zinc-500">Ingresso #02</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-zinc-300">22:42</p>
            <p class="text-xs text-red-400">Já utilizado</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <CheckCircleIcon class="h-4 w-4 shrink-0 text-green-500" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-white">Pedro Souza</p>
            <p class="text-xs text-zinc-500">Ingresso #01</p>
          </div>
          <div class="text-right">
            <p class="text-sm text-zinc-300">22:41</p>
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
