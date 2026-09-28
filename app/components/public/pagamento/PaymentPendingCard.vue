<script setup lang="ts">
import { computed, ref } from 'vue'
import { ClipboardDocumentIcon } from '@heroicons/vue/24/outline'

import PaymentExpiration from '~/components/public/pagamento/PaymentExpiration.vue'
import PaymentStatusBadge from '~/components/public/pagamento/PaymentStatusBadge.vue'
import PaymentSummary from '~/components/public/pagamento/PaymentSummary.vue'
import type { CheckoutPublico } from '~/types/checkoutPagamento'
import type { PaymentStatus } from '~/types/pagamento'

interface PixData {
  pixCopyPaste: string | null
  pixQrCode: string | null
  expiresAt: string | null
}

const props = defineProps<{
  checkout: CheckoutPublico
  textoCountdown: string
  tempoEsgotado: boolean
  pix: PixData | null
}>()

const emit = defineEmits<{
  atualizar: []
}>()

const statusPagamento: PaymentStatus = props.checkout.pagamento?.status ?? 'PENDENTE'

const qrSrc = computed(() => {
  const qr = props.pix?.pixQrCode
  if (!qr) return null
  return qr.startsWith('data:') ? qr : `data:image/jpeg;base64,${qr}`
})

const temPix = computed(() => Boolean(props.pix?.pixCopyPaste || qrSrc.value))
const copiado = ref(false)

async function copiar() {
  const codigo = props.pix?.pixCopyPaste
  if (!codigo || typeof navigator === 'undefined' || !navigator.clipboard) return
  try {
    await navigator.clipboard.writeText(codigo)
    copiado.value = true
    setTimeout(() => {
      copiado.value = false
    }, 2000)
  } catch {
    // silencioso
  }
}
</script>

<template>
  <section class="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-semibold text-white">Pagamento pendente</h2>
      <PaymentStatusBadge :status="statusPagamento" />
    </div>

    <PaymentSummary :checkout="props.checkout" />

    <div v-if="temPix" class="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4">
      <p class="text-sm font-semibold text-zinc-200">Pague com Pix</p>

      <div v-if="qrSrc" class="mx-auto w-full max-w-[240px] rounded-xl bg-white p-3">
        <img :src="qrSrc" alt="QR Code Pix" class="h-auto w-full" />
      </div>

      <div v-if="props.pix?.pixCopyPaste" class="space-y-2">
        <p class="text-xs uppercase tracking-wide text-zinc-500">Pix copia e cola</p>
        <p
          class="max-h-24 overflow-y-auto break-all rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300"
        >
          {{ props.pix.pixCopyPaste }}
        </p>
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 py-3 text-xs font-bold uppercase tracking-wide text-zinc-950 transition-colors duration-150 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
          @click="copiar"
        >
          <ClipboardDocumentIcon class="h-4 w-4" />
          {{ copiado ? 'Código Pix copiado.' : 'Copiar código Pix' }}
        </button>
      </div>
    </div>

    <div v-else class="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/40 p-4">
      <p class="text-sm font-semibold text-zinc-200">Pagamento via Pix</p>
      <p class="mt-1 text-sm text-zinc-500">
        Os dados do Pix serão disponibilizados quando a integração com o provedor for concluída.
      </p>
    </div>

    <PaymentExpiration
      :texto="props.textoCountdown"
      :esgotado="props.tempoEsgotado"
      @atualizar="emit('atualizar')"
    />

    <button
      type="button"
      class="flex w-full items-center justify-center rounded-xl border border-zinc-700 px-6 py-3 text-xs font-bold uppercase tracking-wide text-zinc-300 transition-colors duration-150 hover:border-zinc-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
      @click="emit('atualizar')"
    >
      Atualizar status
    </button>
  </section>
</template>
