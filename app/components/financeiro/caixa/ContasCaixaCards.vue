<script setup lang="ts">
import { computed } from 'vue'

import type { ContaCaixa } from '~/types/caixa'
import { rotuloTipoConta } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'

const props = defineProps<{
  contas: ContaCaixa[]
}>()

const emit = defineEmits<{
  'informar-saldo': [conta: ContaCaixa]
}>()

const ativas = computed(() => props.contas.filter((c) => c.ativa))
const configuradas = computed(() => ativas.value.filter((c) => c.configurada))
const total = computed(() => configuradas.value.reduce((s, c) => s + c.saldoAtual, 0))
const faltam = computed(() => ativas.value.filter((c) => !c.configurada).length)
</script>

<template>
  <section class="space-y-3">
    <div
      v-if="faltam > 0"
      class="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-sm text-amber-200"
    >
      <p class="font-semibold">Para começar, informe o saldo de hoje de cada conta.</p>
      <p class="mt-1 text-amber-200/80">
        O caixa conta a partir desse momento. Vendas de ingresso de antes não entram no saldo
        (continuam na aba Pagamentos de ingressos).
      </p>
    </div>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <div class="col-span-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4 lg:col-span-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Saldo total</p>
        <p class="mt-2 text-2xl font-bold" :class="total < 0 ? 'text-red-400' : 'text-white'">
          {{ formatMoeda(total) }}
        </p>
        <p class="mt-1 text-xs text-zinc-500">
          {{ configuradas.length }} de {{ ativas.length }} contas configuradas
        </p>
      </div>

      <div
        v-for="conta in ativas"
        :key="conta.id"
        class="flex flex-col justify-between rounded-xl border bg-zinc-900 p-4"
        :class="conta.configurada ? 'border-zinc-800' : 'border-dashed border-amber-400/40'"
      >
        <div>
          <p class="truncate text-sm font-semibold text-zinc-200">{{ conta.nome }}</p>
          <p class="text-xs text-zinc-500">{{ rotuloTipoConta(conta.tipo) }}</p>
        </div>
        <template v-if="conta.configurada">
          <p class="mt-3 text-lg font-bold" :class="conta.saldoAtual < 0 ? 'text-red-400' : 'text-white'">
            {{ formatMoeda(conta.saldoAtual) }}
          </p>
        </template>
        <button
          v-else
          type="button"
          class="mt-3 cursor-pointer rounded-lg border border-amber-400/60 px-2 py-1.5 text-xs font-semibold text-amber-400 transition-colors hover:bg-amber-400/10"
          @click="emit('informar-saldo', conta)"
        >
          Informar saldo de hoje
        </button>
      </div>
    </div>
  </section>
</template>
