<script setup lang="ts">
const route = useRoute()

const abas = [
  { to: '/financeiro', label: 'Caixa' },
  { to: '/financeiro/fluxo', label: 'Fluxo de caixa' },
  { to: '/financeiro/pagamentos', label: 'Pagamentos de ingressos' },
  { to: '/financeiro/configuracoes', label: 'Contas e categorias' }
]

function ativa(to: string) {
  return route.path === to || route.path === `${to}/`
}
</script>

<template>
  <nav class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" aria-label="Seções do financeiro">
    <div class="inline-flex min-w-max gap-1 rounded-lg border border-zinc-800 bg-zinc-950 p-1">
      <NuxtLink
        v-for="aba in abas"
        :key="aba.to"
        :to="aba.to"
        class="whitespace-nowrap rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wide transition-colors duration-150"
        :class="ativa(aba.to) ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400 hover:text-zinc-100'"
      >
        {{ aba.label }}
      </NuxtLink>
    </div>
  </nav>
</template>
