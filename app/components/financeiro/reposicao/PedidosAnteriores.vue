<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { toast } from 'vue3-toastify'
import { ChevronDownIcon, DocumentDuplicateIcon } from '@heroicons/vue/24/outline'

import { listarPedidosReposicao } from '~/services/admin/reposicao'
import type { PedidoReposicao } from '~/types/reposicao'
import { formatarDataCurta } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'
import {
  agruparPorFornecedor,
  faltaPedir,
  mensagemErroReposicao,
  mensagemPedido,
  quantidadeParaTexto,
  totalEstimado,
  unidadeComPlural,
  valorEstimado
} from '~/utils/reposicao'

// Pedidos de semanas anteriores (so os itens que tinham quantidade).

const pedidos = ref<PedidoReposicao[]>([])
const carregando = ref(true)
const erro = ref('')
const aberto = ref<string | null>(null)

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    pedidos.value = await listarPedidosReposicao(30)
  } catch (e) {
    erro.value = mensagemErroReposicao(e, 'Não foi possível carregar os pedidos.')
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
defineExpose({ carregar })

function dataDoPedido(p: PedidoReposicao) {
  return formatarDataCurta((p.finalizadoEm ?? p.criadoEm).slice(0, 10))
}

async function copiar(p: PedidoReposicao) {
  try {
    await navigator.clipboard.writeText(mensagemPedido(p.itens, { data: dataDoPedido(p) }))
    toast.success('Pedido copiado.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="erro" class="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{{ erro }}</p>

    <div v-if="carregando" class="flex items-center gap-3 p-6 text-sm text-zinc-400">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" aria-hidden="true" />
      Carregando...
    </div>

    <p
      v-else-if="!pedidos.length && !erro"
      class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400"
    >
      Nenhum pedido finalizado ainda. Quando você finalizar o pedido da semana, ele aparece aqui.
    </p>

    <div v-for="p in pedidos" :key="p.id" class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <button
        type="button"
        class="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/40"
        @click="aberto = aberto === p.id ? null : p.id"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-white">Pedido de {{ dataDoPedido(p) }}</p>
          <p class="text-xs text-zinc-500">
            {{ p.itens.length }} {{ p.itens.length === 1 ? 'item' : 'itens' }}
            <template v-if="faltaPedir(p.itens).length"> · <span class="text-amber-400">{{ faltaPedir(p.itens).length }} não marcados</span></template>
          </p>
        </div>
        <p class="shrink-0 font-semibold text-white">{{ formatMoeda(totalEstimado(p.itens)) }}</p>
        <ChevronDownIcon class="h-4 w-4 shrink-0 text-zinc-500 transition-transform" :class="aberto === p.id ? 'rotate-180' : ''" />
      </button>

      <div v-if="aberto === p.id" class="space-y-3 border-t border-zinc-800 p-4">
        <div v-for="g in agruparPorFornecedor(p.itens)" :key="g.fornecedor ?? ''">
          <p class="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{{ g.fornecedor ?? 'Sem fornecedor' }}</p>
          <ul class="space-y-1">
            <li v-for="i in g.itens" :key="i.id" class="flex items-center gap-2 text-sm">
              <span :class="i.pedidoFeito ? 'text-emerald-400' : 'text-amber-400'" :title="i.pedidoFeito ? 'Pedido' : 'Não marcado como pedido'">
                {{ i.pedidoFeito ? '✓' : '•' }}
              </span>
              <span class="min-w-0 flex-1 truncate text-zinc-200">
                {{ quantidadeParaTexto(i.quantidade) }} {{ unidadeComPlural(i.unidade, i.quantidade) }}<template v-if="i.unidadesPorEmbalagem > 1"> ({{ quantidadeParaTexto(i.unidadesPorEmbalagem) }} un.)</template> · {{ i.nome }}
              </span>
              <span class="shrink-0 text-xs text-zinc-500">{{ valorEstimado(i) !== null ? formatMoeda(valorEstimado(i)!) : '' }}</span>
            </li>
          </ul>
        </div>
        <button
          type="button"
          class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
          @click="copiar(p)"
        >
          <DocumentDuplicateIcon class="h-3.5 w-3.5" /> Copiar pedido
        </button>
      </div>
    </div>
  </div>
</template>
