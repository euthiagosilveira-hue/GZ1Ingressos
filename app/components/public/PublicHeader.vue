<script setup lang="ts">
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

      <nav class="flex items-center gap-5 text-sm">
        <NuxtLink
          to="/eventos-publicos"
          class="text-zinc-300 transition-colors hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        >
          Eventos
        </NuxtLink>
        <span
          class="hidden cursor-not-allowed text-zinc-600 sm:inline"
          aria-disabled="true"
          title="Disponível em breve"
        >
          Meus ingressos
        </span>
      </nav>
    </div>
  </header>
</template>
