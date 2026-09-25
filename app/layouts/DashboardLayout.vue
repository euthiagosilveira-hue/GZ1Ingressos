<script setup lang="ts">
import {
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  PhoneIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  TicketIcon,
  UserCircleIcon,
  UsersIcon
} from '@heroicons/vue/24/outline'
import { useRoute } from '#imports'

import PageHeader from '~/components/PageHeader.vue'
import SidebarItem from '~/components/SidebarItem.vue'
import UserChip from '~/components/UserChip.vue'

const route = useRoute()
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-zinc-950 text-white">
    <!-- Sidebar -->
    <aside class="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-zinc-800 p-4 lg:flex">
      <div class="mb-6 flex justify-center">
        <img src="/Logo horizontal.png" alt="Galería Zero 1" class="h-10 w-auto" />
      </div>

      <nav class="flex flex-1 flex-col gap-1">
        <SidebarItem to="/" :icon="Squares2X2Icon" label="Dashboard" active />
        <SidebarItem to="#" :icon="CalendarDaysIcon" label="Eventos" />
        <SidebarItem to="#" :icon="RectangleStackIcon" label="Pedidos" badge="328" />
        <SidebarItem to="#" :icon="TicketIcon" label="Ingressos" />
        <SidebarItem to="#" :icon="ArrowRightOnRectangleIcon" label="Entradas" badge="261" />
        <SidebarItem to="#" :icon="UsersIcon" label="Participantes" />
        <SidebarItem to="#" :icon="BanknotesIcon" label="Financeiro" />
        <SidebarItem to="#" :icon="ChartBarIcon" label="Relatórios" />
        <SidebarItem to="#" :icon="Cog6ToothIcon" label="Configurações" />
      </nav>

      <div class="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div class="flex items-center gap-2 text-amber-400">
          <PhoneIcon class="h-5 w-5" />
          <span class="text-sm font-semibold">Precisa de ajuda?</span>
        </div>
        <p class="mt-1 text-xs text-zinc-400">Fale com o suporte</p>
      </div>
    </aside>

    <!-- Content -->
    <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
      <!-- Header -->
      <header class="px-6 pt-6">
        <PageHeader :title="route.meta.title" :subtitle="route.meta.description">
          <template #actions>
            <div class="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
              <CalendarDaysIcon class="h-4 w-4 text-zinc-400" />
              <span class="text-sm text-zinc-200">Sábado - 29 de Agosto</span>
              <ChevronDownIcon class="h-4 w-4 text-zinc-400" />
            </div>
            <div class="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2">
              <UserCircleIcon class="h-8 w-8 text-amber-400" />
              <UserChip name="Galeria Zero 1" role="Administrador" />
            </div>
          </template>
        </PageHeader>
      </header>

      <!-- Main -->
      <main class="flex-1 space-y-6 overflow-y-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
