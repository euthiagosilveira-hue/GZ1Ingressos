<script setup lang="ts">
import { ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'

const { operador, logout } = useOperatorAuth()

async function sair() {
  await logout().catch(() => {})
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-white">
    <header class="sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <NuxtLink to="/produtor" class="flex min-w-0 items-center gap-3">
          <img src="/Logo horizontal.png" alt="Galeria Zero 1" class="h-8 w-auto shrink-0" />
          <span class="hidden text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400 sm:inline">
            Área do produtor
          </span>
        </NuxtLink>
        <div class="flex items-center gap-3">
          <span v-if="operador" class="hidden max-w-[12rem] truncate text-sm text-zinc-400 sm:inline">
            {{ operador.nome }}
          </span>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-300 hover:border-amber-400/60 hover:text-amber-400"
            @click="sair"
          >
            <ArrowRightOnRectangleIcon class="h-4 w-4" />
            Sair
          </button>
        </div>
      </div>
    </header>
    <main class="mx-auto w-full max-w-5xl px-4 py-6">
      <slot />
    </main>
  </div>
</template>
