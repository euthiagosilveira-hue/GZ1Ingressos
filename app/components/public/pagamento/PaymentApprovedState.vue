<script setup lang="ts">
import { CheckCircleIcon } from '@heroicons/vue/24/outline'

import PaymentSummary from '~/components/public/pagamento/PaymentSummary.vue'
import type { CheckoutPublico } from '~/types/checkoutPagamento'

const props = defineProps<{
  checkout: CheckoutPublico
}>()
</script>

<template>
  <section class="space-y-5 rounded-2xl border-2 border-green-500/50 bg-zinc-900 p-5 sm:p-6" role="status">
    <div class="flex items-center gap-4">
      <span
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950"
      >
        <CheckCircleIcon class="h-7 w-7 text-green-300" />
      </span>
      <div>
        <p class="text-lg font-bold uppercase tracking-wide text-green-300">Pagamento confirmado</p>
        <p class="text-sm text-zinc-400">Seu pedido está pago.</p>
      </div>
    </div>

    <PaymentSummary :checkout="props.checkout" />

    <button
      type="button"
      disabled
      class="flex w-full cursor-not-allowed items-center justify-center rounded-xl border border-zinc-700 px-6 py-4 text-sm font-bold uppercase tracking-wide text-zinc-500 opacity-70"
    >
      Ver ingressos (em breve)
    </button>
  </section>
</template>
