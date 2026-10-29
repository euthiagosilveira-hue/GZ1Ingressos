<script setup lang="ts">
import { TicketIcon } from '@heroicons/vue/24/outline'

import { PUBLIC_NAV_ITEMS } from '~/utils/publicNav'
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-zinc-800 bg-black/90 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
      <NuxtLink
        to="/eventos-publicos"
        class="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
      >
        <img src="/Logo horizontal.png" alt="Galeria Zero 1" class="h-8 w-auto" />
      </NuxtLink>

      <nav class="flex items-center gap-4 text-sm sm:gap-5">
        <NuxtLink
          v-for="item in PUBLIC_NAV_ITEMS"
          :key="item.to"
          :to="item.to"
          :class="
            item.destaque
              ? 'inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-zinc-950 hover:bg-amber-300'
              : 'text-zinc-300 hover:text-amber-400'
          "
          class="transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        >
          <TicketIcon v-if="item.destaque" class="h-4 w-4" />
          {{ item.label }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
