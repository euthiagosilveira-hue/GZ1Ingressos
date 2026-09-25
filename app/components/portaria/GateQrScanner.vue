<script setup lang="ts">
import { QrCodeIcon } from '@heroicons/vue/24/outline'

import BaseCard from '~/components/BaseCard.vue'
</script>

<template>
  <BaseCard class="space-y-4">
    <div
      class="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"
    >
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
        <QrCodeIcon class="h-16 w-16 text-zinc-700" />
        <p class="px-6 text-sm text-zinc-500">Aponte a câmera para o QR Code</p>
      </div>

      <span
        class="absolute left-4 top-4 h-8 w-8 rounded-tl-lg border-l-2 border-t-2 border-amber-400"
      ></span>
      <span
        class="absolute right-4 top-4 h-8 w-8 rounded-tr-lg border-r-2 border-t-2 border-amber-400"
      ></span>
      <span
        class="absolute bottom-4 left-4 h-8 w-8 rounded-bl-lg border-b-2 border-l-2 border-amber-400"
      ></span>
      <span
        class="absolute bottom-4 right-4 h-8 w-8 rounded-br-lg border-b-2 border-r-2 border-amber-400"
      ></span>
    </div>

    <p class="text-center text-xs text-zinc-500">
      Scanner real será integrado posteriormente.
    </p>
  </BaseCard>
</template>
