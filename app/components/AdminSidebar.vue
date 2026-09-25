<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import {
  ArrowRightOnRectangleIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  PhoneIcon,
  QrCodeIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  TicketIcon,
  UsersIcon,
  XMarkIcon
} from '@heroicons/vue/24/outline'
import { useRoute } from '#imports'

import SidebarItem from '~/components/SidebarItem.vue'

const props = withDefaults(
  defineProps<{
    mobile?: boolean
  }>(),
  { mobile: false }
)

const emit = defineEmits<{
  close: []
  navigate: []
}>()

interface NavItem {
  to: string
  icon: Component
  label: string
  badge?: string
}

const route = useRoute()

const activeLabel = computed(() => {
  const meta = route.meta.sidebarActive
  return typeof meta === 'string' ? meta : 'Dashboard'
})

const items: NavItem[] = [
  { to: '/', icon: Squares2X2Icon, label: 'Dashboard' },
  { to: '/eventos', icon: CalendarDaysIcon, label: 'Eventos' },
  { to: '/pedidos', icon: RectangleStackIcon, label: 'Pedidos', badge: '128' },
  { to: '/ingressos', icon: TicketIcon, label: 'Ingressos' },
  { to: '/entradas', icon: ArrowRightOnRectangleIcon, label: 'Entradas', badge: '281' },
  { to: '/portaria', icon: QrCodeIcon, label: 'Portaria' },
  { to: '#', icon: UsersIcon, label: 'Participantes' },
  { to: '/financeiro', icon: BanknotesIcon, label: 'Financeiro' },
  { to: '#', icon: ChartBarIcon, label: 'Relatórios' },
  { to: '#', icon: Cog6ToothIcon, label: 'Configurações' }
]

const raizClasses = computed(() =>
  props.mobile
    ? 'flex h-full w-full flex-col overflow-y-auto bg-zinc-950 p-5'
    : 'w-72 shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-5'
)
</script>

<template>
  <aside :class="raizClasses">
    <div class="relative mb-8 flex items-center justify-center">
      <img src="/Logo horizontal.png" alt="Galeria Zero 1" class="h-11 w-auto" />
      <button
        v-if="props.mobile"
        type="button"
        aria-label="Fechar menu"
        class="absolute right-0 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 transition-colors duration-150 hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        @click="emit('close')"
      >
        <XMarkIcon class="h-5 w-5" />
      </button>
    </div>

    <nav class="flex flex-1 flex-col gap-1.5">
      <SidebarItem
        v-for="item in items"
        :key="item.label"
        :to="item.to"
        :icon="item.icon"
        :label="item.label"
        :badge="item.badge"
        :active="item.label === activeLabel"
        size="lg"
        @click="emit('navigate')"
      />
    </nav>

    <div class="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div class="flex items-center gap-2.5 text-amber-400">
        <PhoneIcon class="h-6 w-6" />
        <span class="text-sm font-semibold">Precisa de ajuda?</span>
      </div>
      <p class="mt-1.5 text-xs text-zinc-400">Fale com o suporte</p>
    </div>
  </aside>
</template>
