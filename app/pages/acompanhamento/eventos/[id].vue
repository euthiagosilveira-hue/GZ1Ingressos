<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowLeftIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'

import BaseCard from '~/components/BaseCard.vue'
import BaseInput from '~/components/BaseInput.vue'
import EventStatusBadge from '~/components/eventos/EventStatusBadge.vue'
import {
  listarVendasEventoAcompanhamento,
  obterEventoAcompanhamento
} from '~/services/acompanhamento/eventos'
import type { EventoAcompanhamentoDetalhe, VendaAcompanhamento } from '~/types/acompanhamento'
import type { EventStatus } from '~/types/evento'
import { filtrarVendasPorNome, formatarDiaVenda } from '~/utils/acompanhamento'
import { formatDataHora, formatMoeda } from '~/utils/format'

definePageMeta({
  layout: 'acompanhamento-layout',
  middleware: ['acompanhamento-auth']
})

const route = useRoute()
const eventoId = String(route.params.id)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ATUALIZAR_A_CADA_MS = 60_000

const evento = ref<EventoAcompanhamentoDetalhe | null>(null)
const vendas = ref<VendaAcompanhamento[]>([])
const carregando = ref(true)
const atualizando = ref(false)
const erro = ref('')
const atualizadoEm = ref<Date | null>(null)
const aba = ref<'lotes' | 'dias' | 'compradores'>('lotes')
const busca = ref('')
let timer: ReturnType<typeof setInterval> | null = null

useSeoMeta({ title: () => `${evento.value?.nome ?? 'Evento'} | GZ1 Ingresso` })

const vendasFiltradas = computed(() => filtrarVendasPorNome(vendas.value, busca.value))
const lotesComVenda = computed(() => evento.value?.resumo.porLote ?? [])
const horaAtualizacao = computed(() =>
  atualizadoEm.value
    ? atualizadoEm.value.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })
    : ''
)

async function buscar() {
  const [e, v] = await Promise.all([
    obterEventoAcompanhamento(eventoId),
    listarVendasEventoAcompanhamento(eventoId)
  ])
  evento.value = e
  vendas.value = v
  atualizadoEm.value = new Date()
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  if (!UUID.test(eventoId)) {
    erro.value = 'Evento não encontrado.'
    carregando.value = false
    return
  }
  try {
    await buscar()
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar o evento.'
  } finally {
    carregando.value = false
  }
}

async function atualizar() {
  if (atualizando.value || carregando.value || erro.value) return
  atualizando.value = true
  try {
    await buscar()
  } catch {
    // Mantem os numeros anteriores; tenta de novo no proximo ciclo.
  } finally {
    atualizando.value = false
  }
}

function aoVoltarParaPagina() {
  if (document.visibilityState === 'visible') void atualizar()
}

onMounted(() => {
  void carregar()
  timer = setInterval(() => {
    if (document.visibilityState === 'visible') void atualizar()
  }, ATUALIZAR_A_CADA_MS)
  document.addEventListener('visibilitychange', aoVoltarParaPagina)
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  document.removeEventListener('visibilitychange', aoVoltarParaPagina)
})
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/acompanhamento" class="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-amber-400">
      <ArrowLeftIcon class="h-4 w-4" />
      Meus eventos
    </NuxtLink>

    <div v-if="carregando" class="space-y-3" aria-busy="true">
      <div v-for="n in 3" :key="n" class="h-32 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <div v-else-if="erro" role="alert" class="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center">
      <p class="text-sm font-semibold text-red-300">{{ erro }}</p>
      <button type="button" class="text-xs font-semibold uppercase tracking-wide text-amber-400" @click="carregar">
        Tentar novamente
      </button>
    </div>

    <template v-else-if="evento">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-semibold">{{ evento.nome }}</h1>
          <EventStatusBadge :status="evento.status as EventStatus" />
        </div>
        <p class="text-sm text-zinc-400">
          {{ formatDataHora(evento.inicioEm) }}<span v-if="evento.local"> · {{ evento.local }}</span>
        </p>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-amber-400"
          :disabled="atualizando"
          @click="atualizar"
        >
          <ArrowPathIcon class="h-3.5 w-3.5" :class="atualizando ? 'animate-spin' : ''" />
          Atualizado às {{ horaAtualizacao }} · atualiza sozinho a cada minuto
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="col-span-2 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-4 sm:col-span-1">
          <p class="text-xs uppercase tracking-wide text-zinc-400">Total vendido</p>
          <p class="mt-1 text-2xl font-semibold text-amber-300">{{ formatMoeda(evento.resumo.valorTotal) }}</p>
          <p class="text-xs text-zinc-500">
            Online {{ formatMoeda(evento.resumo.valorOnline) }} · Portaria {{ formatMoeda(evento.resumo.valorPortaria) }}
          </p>
        </div>
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Ingressos vendidos</p>
          <p class="mt-1 text-xl font-semibold">{{ evento.resumo.ingressos }}</p>
          <p v-if="evento.capacidadeTotal" class="text-xs text-zinc-500">de {{ evento.capacidadeTotal }} lugares</p>
        </div>
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Já entraram</p>
          <p class="mt-1 text-xl font-semibold">{{ evento.utilizados }}</p>
        </div>
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Lote atual</p>
          <p class="mt-1 truncate text-base font-semibold">
            {{ evento.loteAtivo ? evento.loteAtivo.nome : '—' }}
          </p>
          <p v-if="evento.loteAtivo" class="text-xs text-zinc-500">{{ formatMoeda(evento.loteAtivo.preco) }}</p>
        </div>
      </div>

      <BaseCard class="space-y-4">
        <div class="inline-flex flex-wrap rounded-lg border border-zinc-800 p-1">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
            :class="aba === 'lotes' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'"
            @click="aba = 'lotes'"
          >
            Por lote
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
            :class="aba === 'dias' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'"
            @click="aba = 'dias'"
          >
            Por dia
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
            :class="aba === 'compradores' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'"
            @click="aba = 'compradores'"
          >
            Compradores ({{ vendas.length }})
          </button>
        </div>

        <!-- Por lote -->
        <template v-if="aba === 'lotes'">
          <p v-if="lotesComVenda.length === 0" class="text-sm text-zinc-500">Este evento ainda não tem lotes.</p>
          <ul v-else class="divide-y divide-zinc-800">
            <li v-for="lote in lotesComVenda" :key="lote.loteId ?? 'sem-lote'" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-white">
                  {{ lote.nome }}
                  <span v-if="lote.status === 'ATIVO'" class="ml-1 text-xs font-semibold text-green-400">à venda</span>
                </p>
                <p class="text-xs text-zinc-500">
                  {{ lote.ingressos }}<span v-if="lote.disponibilizados"> de {{ lote.disponibilizados }}</span>
                  {{ lote.ingressos === 1 ? 'ingresso' : 'ingressos' }}
                  <span v-if="lote.preco != null"> · {{ formatMoeda(lote.preco) }} cada</span>
                </p>
              </div>
              <p class="shrink-0 text-sm font-semibold text-zinc-200">{{ formatMoeda(lote.valor) }}</p>
            </li>
          </ul>
        </template>

        <!-- Por dia -->
        <template v-else-if="aba === 'dias'">
          <p v-if="evento.resumo.porDia.length === 0" class="text-sm text-zinc-500">Nenhuma venda confirmada ainda.</p>
          <ul v-else class="divide-y divide-zinc-800">
            <li v-for="dia in evento.resumo.porDia" :key="dia.dia" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="text-sm font-medium capitalize text-white">{{ formatarDiaVenda(dia.dia) }}</p>
                <p class="text-xs text-zinc-500">{{ dia.ingressos }} {{ dia.ingressos === 1 ? 'ingresso' : 'ingressos' }}</p>
              </div>
              <p class="shrink-0 text-sm font-semibold text-zinc-200">{{ formatMoeda(dia.valor) }}</p>
            </li>
          </ul>
        </template>

        <!-- Compradores -->
        <template v-else>
          <BaseInput v-model="busca" placeholder="Buscar comprador pelo nome" />
          <p v-if="vendas.length === 0" class="text-sm text-zinc-500">Nenhuma venda confirmada ainda.</p>
          <p v-else-if="vendasFiltradas.length === 0" class="text-sm text-zinc-500">Ninguém encontrado com esse nome.</p>
          <ul v-else class="divide-y divide-zinc-800">
            <li v-for="venda in vendasFiltradas" :key="venda.codigo" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-white">{{ venda.compradorNome }}</p>
                <p class="text-xs text-zinc-500">
                  {{ venda.quantidade }} {{ venda.quantidade === 1 ? 'ingresso' : 'ingressos' }}
                  <span v-if="venda.loteNome"> · {{ venda.loteNome }}</span>
                  · {{ venda.forma === 'ONLINE' ? 'Online' : 'Portaria' }}
                  <span v-if="venda.pagoEm"> · {{ formatDataHora(venda.pagoEm) }}</span>
                </p>
              </div>
              <p class="shrink-0 text-sm font-semibold text-zinc-200">{{ formatMoeda(venda.valorTotal) }}</p>
            </li>
          </ul>
        </template>
      </BaseCard>

      <p class="text-xs text-zinc-500">
        Valores dos ingressos pagos (Pix online e vendas na portaria). Cortesias e lista VIP não entram no total.
      </p>
    </template>
  </div>
</template>
