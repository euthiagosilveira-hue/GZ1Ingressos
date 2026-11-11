<script setup lang="ts">
import {
  ArrowsRightLeftIcon,
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  PaperClipIcon,
  PencilSquareIcon,
  TicketIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline'

import type { LancamentoCaixa } from '~/types/caixa'
import { contaExibida, formatarDataCurta, podeEditar, rotuloOrigemLancamento } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'

const props = defineProps<{
  itens: LancamentoCaixa[]
}>()

const emit = defineEmits<{
  editar: [l: LancamentoCaixa]
  cancelar: [l: LancamentoCaixa]
  comprovante: [l: LancamentoCaixa]
}>()

function corValor(l: LancamentoCaixa) {
  if (l.canceladoEm) return 'text-zinc-500 line-through'
  if (l.tipo === 'ENTRADA') return 'text-emerald-400'
  if (l.tipo === 'SAIDA') return 'text-red-400'
  return 'text-sky-300'
}

function sinal(l: LancamentoCaixa) {
  if (l.tipo === 'ENTRADA') return '+ '
  if (l.tipo === 'SAIDA') return '− '
  return ''
}

function titulo(l: LancamentoCaixa) {
  if (l.descricao) return l.descricao
  if (l.tipo === 'TRANSFERENCIA') return 'Transferência entre contas'
  return l.categoriaNome
}
</script>

<template>
  <div>
    <!-- Desktop -->
    <div class="hidden overflow-hidden rounded-xl border border-zinc-800 lg:block">
      <table class="w-full text-left text-sm">
        <thead class="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
          <tr>
            <th class="px-4 py-3 font-semibold">Data</th>
            <th class="px-4 py-3 font-semibold">Descrição</th>
            <th class="px-4 py-3 font-semibold">Categoria</th>
            <th class="px-4 py-3 font-semibold">Conta</th>
            <th class="px-4 py-3 font-semibold">Evento</th>
            <th class="px-4 py-3 text-right font-semibold">Valor</th>
            <th class="w-28 px-4 py-3"><span class="sr-only">Ações</span></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-zinc-800 bg-zinc-950/40">
          <tr v-for="l in props.itens" :key="l.id" :class="l.canceladoEm ? 'opacity-60' : ''">
            <td class="whitespace-nowrap px-4 py-3 text-zinc-300">{{ formatarDataCurta(l.data) }}</td>
            <td class="max-w-xs px-4 py-3">
              <p class="truncate text-zinc-100" :title="titulo(l)">{{ titulo(l) }}</p>
              <p v-if="l.canceladoEm" class="truncate text-xs text-red-400">Cancelado: {{ l.motivoCancelamento }}</p>
              <p v-else-if="l.origem !== 'MANUAL'" class="text-xs text-zinc-500">{{ rotuloOrigemLancamento(l.origem) }}</p>
            </td>
            <td class="px-4 py-3 text-zinc-400">{{ l.tipo === 'TRANSFERENCIA' ? 'Transferência' : l.categoriaNome }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-zinc-400">{{ contaExibida(l) }}</td>
            <td class="max-w-[12rem] truncate px-4 py-3 text-zinc-400">{{ l.eventoNome || '—' }}</td>
            <td class="whitespace-nowrap px-4 py-3 text-right font-semibold" :class="corValor(l)">
              {{ sinal(l) }}{{ formatMoeda(l.valor) }}
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-1">
                <button
                  v-if="l.comprovantePath"
                  type="button"
                  title="Ver comprovante"
                  class="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400"
                  @click="emit('comprovante', l)"
                >
                  <PaperClipIcon class="h-4 w-4" />
                </button>
                <NuxtLink
                  v-if="l.pedidoId"
                  :to="`/pedidos/${l.pedidoId}`"
                  title="Ver pedido"
                  class="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400"
                >
                  <TicketIcon class="h-4 w-4" />
                </NuxtLink>
                <template v-if="podeEditar(l)">
                  <button
                    type="button"
                    title="Editar"
                    class="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400"
                    @click="emit('editar', l)"
                  >
                    <PencilSquareIcon class="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Cancelar"
                    class="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
                    @click="emit('cancelar', l)"
                  >
                    <XCircleIcon class="h-4 w-4" />
                  </button>
                </template>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Celular -->
    <ul class="space-y-2 lg:hidden">
      <li
        v-for="l in props.itens"
        :key="l.id"
        class="rounded-xl border border-zinc-800 bg-zinc-900 p-3"
        :class="l.canceladoEm ? 'opacity-60' : ''"
      >
        <div class="flex items-start gap-3">
          <div
            class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            :class="
              l.tipo === 'ENTRADA'
                ? 'bg-emerald-400/10 text-emerald-400'
                : l.tipo === 'SAIDA'
                  ? 'bg-red-400/10 text-red-400'
                  : 'bg-sky-400/10 text-sky-300'
            "
          >
            <ArrowDownLeftIcon v-if="l.tipo === 'ENTRADA'" class="h-4 w-4" />
            <ArrowUpRightIcon v-else-if="l.tipo === 'SAIDA'" class="h-4 w-4" />
            <ArrowsRightLeftIcon v-else class="h-4 w-4" />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="truncate text-sm font-medium text-zinc-100">{{ titulo(l) }}</p>
              <p class="whitespace-nowrap text-sm font-semibold" :class="corValor(l)">
                {{ sinal(l) }}{{ formatMoeda(l.valor) }}
              </p>
            </div>
            <p class="truncate text-xs text-zinc-500">
              {{ formatarDataCurta(l.data) }} ·
              {{ l.tipo === 'TRANSFERENCIA' ? 'Transferência' : l.categoriaNome }} ·
              {{ contaExibida(l) }}
            </p>
            <p v-if="l.eventoNome" class="truncate text-xs text-zinc-500">{{ l.eventoNome }}</p>
            <p v-if="l.canceladoEm" class="text-xs text-red-400">Cancelado: {{ l.motivoCancelamento }}</p>

            <div
              v-if="l.comprovantePath || l.pedidoId || podeEditar(l)"
              class="mt-2 flex flex-wrap gap-3 text-xs font-semibold"
            >
              <button v-if="l.comprovantePath" type="button" class="cursor-pointer text-amber-400" @click="emit('comprovante', l)">
                Comprovante
              </button>
              <NuxtLink v-if="l.pedidoId" :to="`/pedidos/${l.pedidoId}`" class="text-amber-400">Ver pedido</NuxtLink>
              <template v-if="podeEditar(l)">
                <button type="button" class="cursor-pointer text-amber-400" @click="emit('editar', l)">Editar</button>
                <button type="button" class="cursor-pointer text-red-400" @click="emit('cancelar', l)">Cancelar</button>
              </template>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
