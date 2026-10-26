<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue3-toastify'

import AppButton from '~/components/AppButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import {
  conferirPagamentosExpiradosAdmin,
  liberarPagamentosExpiradosAdmin,
  type PedidoExpiradoConferido,
  type SituacaoPedidoExpirado
} from '~/services/admin/eventos'
import { formatDataHora, formatMoeda } from '~/utils/format'

const props = defineProps<{
  open: boolean
  eventoId: string | null
  eventoNome?: string
}>()

const emit = defineEmits<{
  close: []
}>()

const pedidos = ref<PedidoExpiradoConferido[]>([])
const carregando = ref(false)
const erro = ref('')
const liberando = ref(false)

const pagos = computed(() => pedidos.value.filter((pedido) => pedido.situacao === 'PAGO'))
const ingressosPagos = computed(() =>
  pagos.value.reduce((total, pedido) => total + pedido.quantidade, 0)
)
// Pagos primeiro: sao os que precisam de acao.
const ordenados = computed(() =>
  [...pedidos.value].sort(
    (a, b) => Number(b.situacao === 'PAGO') - Number(a.situacao === 'PAGO')
  )
)

const ROTULOS: Record<SituacaoPedidoExpirado, { texto: string; classe: string }> = {
  PAGO: { texto: 'Pago no Mercado Pago', classe: 'bg-emerald-500/15 text-emerald-300' },
  NAO_PAGO: { texto: 'Não pagou', classe: 'bg-zinc-800 text-zinc-400' },
  SEM_PIX: { texto: 'Pix não gerado', classe: 'bg-zinc-800 text-zinc-400' },
  ERRO_CONSULTA: { texto: 'Não consegui consultar', classe: 'bg-amber-500/15 text-amber-300' }
}

async function conferir() {
  if (!props.eventoId) return
  carregando.value = true
  erro.value = ''
  try {
    pedidos.value = await conferirPagamentosExpiradosAdmin(props.eventoId)
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível conferir os pagamentos.'
  } finally {
    carregando.value = false
  }
}

async function liberar() {
  if (!props.eventoId) return
  liberando.value = true
  try {
    const { liberados, falhas } = await liberarPagamentosExpiradosAdmin(props.eventoId)
    if (falhas.length > 0) {
      toast.error(`Não foi possível liberar: ${falhas.join(', ')}`)
    }
    if (liberados.length > 0) {
      toast.success(
        liberados.length === 1
          ? 'Pedido liberado. Os ingressos já valem na portaria.'
          : `${liberados.length} pedidos liberados. Os ingressos já valem na portaria.`
      )
    }
    await conferir()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível liberar os pedidos.')
  } finally {
    liberando.value = false
  }
}

watch(
  () => [props.open, props.eventoId] as const,
  ([aberto]) => {
    if (aberto) {
      pedidos.value = []
      void conferir()
    }
  },
  { immediate: true }
)
</script>

<template>
  <BaseModal
    :open="props.open"
    size="lg"
    title="Pagamentos de pedidos expirados"
    :subtitle="props.eventoNome"
    @close="emit('close')"
  >
    <div v-if="carregando" class="space-y-3" aria-busy="true">
      <p class="text-sm text-zinc-400">Consultando o Mercado Pago pedido por pedido...</p>
      <div v-for="n in 4" :key="n" class="h-12 animate-pulse rounded-xl bg-zinc-800/60" />
    </div>

    <div v-else-if="erro" role="alert" class="space-y-3 text-center">
      <p class="text-sm font-semibold text-red-300">{{ erro }}</p>
      <AppButton size="sm" @click="conferir">Tentar novamente</AppButton>
    </div>

    <p v-else-if="pedidos.length === 0" class="text-sm text-zinc-400">
      Este evento não tem pedidos expirados.
    </p>

    <div v-else class="space-y-4">
      <p
        class="rounded-xl border p-3 text-sm"
        :class="
          pagos.length > 0
            ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-200'
            : 'border-zinc-800 bg-zinc-950/40 text-zinc-300'
        "
      >
        <template v-if="pagos.length > 0">
          {{ pagos.length }} {{ pagos.length === 1 ? 'pedido foi pago' : 'pedidos foram pagos' }}
          ({{ ingressosPagos }} {{ ingressosPagos === 1 ? 'ingresso' : 'ingressos' }}), mas
          {{ pagos.length === 1 ? 'ficou' : 'ficaram' }} como expirado. Toque em "Liberar" para
          os ingressos valerem na portaria.
        </template>
        <template v-else>
          Nenhum dos {{ pedidos.length }} pedidos expirados foi pago no Mercado Pago.
        </template>
      </p>

      <ul class="divide-y divide-zinc-800 rounded-xl border border-zinc-800">
        <li
          v-for="pedido in ordenados"
          :key="pedido.pedidoId"
          class="flex items-center justify-between gap-3 px-3 py-2.5"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-zinc-100">{{ pedido.compradorNome }}</p>
            <p class="text-xs text-zinc-500">
              {{ pedido.codigo }} · {{ pedido.quantidade }}
              {{ pedido.quantidade === 1 ? 'ingresso' : 'ingressos' }} ·
              {{ formatMoeda(pedido.valorTotal) }} · {{ formatDataHora(pedido.criadoEm) }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
            :class="ROTULOS[pedido.situacao].classe"
          >
            {{ ROTULOS[pedido.situacao].texto }}
          </span>
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" @click="emit('close')">Fechar</AppButton>
        <AppButton
          v-if="pagos.length > 0"
          variant="primary"
          :disabled="liberando || carregando"
          @click="liberar"
        >
          {{
            liberando
              ? 'Liberando...'
              : `Liberar ${pagos.length} ${pagos.length === 1 ? 'pedido' : 'pedidos'}`
          }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
