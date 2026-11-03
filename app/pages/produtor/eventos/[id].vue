<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue3-toastify'
import { ArrowLeftIcon, ArrowDownTrayIcon, TrashIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'
import BaseInput from '~/components/BaseInput.vue'
import EventStatusBadge from '~/components/eventos/EventStatusBadge.vue'
import LinkVendaEvento from '~/components/produtor/LinkVendaEvento.vue'
import SociedadeDivisao from '~/components/sociedade/SociedadeDivisao.vue'
import {
  adicionarVipProdutor,
  baixarListaPagantesProdutor,
  listarVendasEventoProdutor,
  listarVipProdutor,
  obterEventoProdutor,
  removerVipProdutor
} from '~/services/produtor/eventos'
import type { EventStatus } from '~/types/evento'
import type { EventoProdutorDetalhe, VendaProdutor, VipProdutor } from '~/types/produtor'
import type { SociedadeEvento } from '~/types/sociedade'
import { formatDataHora, formatMoeda } from '~/utils/format'

definePageMeta({
  layout: 'produtor-layout',
  middleware: ['produtor-auth']
})

const route = useRoute()
const eventoId = String(route.params.id)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const evento = ref<EventoProdutorDetalhe | null>(null)
const vendas = ref<VendaProdutor[]>([])
const vip = ref<VipProdutor[]>([])
const carregando = ref(true)
const erro = ref('')

const aba = ref<'vendas' | 'vip'>('vendas')
const novoVip = ref('')
const obsVip = ref('')
const salvandoVip = ref(false)

useSeoMeta({ title: () => `${evento.value?.nome ?? 'Evento'} | GZ1 Ingresso` })

const sociedade = computed<SociedadeEvento | null>(() =>
  evento.value
    ? {
        eventoId: evento.value.eventoId,
        ativa: true,
        produtor: {
          produtorId: '',
          nome: evento.value.produtorNome || 'Você',
          documento: null,
          telefone: null,
          email: null,
          ativo: true,
          temLogin: true
        },
        percentualGaleria: evento.value.percentualGaleria,
        percentualProdutor: evento.value.percentualProdutor,
        totais: evento.value.totais
      }
    : null
)

const podeAlterarVip = computed(
  () => evento.value != null && !['REALIZADO', 'CANCELADO'].includes(evento.value.status)
)

async function carregar() {
  carregando.value = true
  erro.value = ''
  if (!UUID.test(eventoId)) {
    erro.value = 'Evento não encontrado.'
    carregando.value = false
    return
  }
  try {
    const [e, v, l] = await Promise.all([
      obterEventoProdutor(eventoId),
      listarVendasEventoProdutor(eventoId),
      listarVipProdutor(eventoId)
    ])
    evento.value = e
    vendas.value = v
    vip.value = l
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar o evento.'
  } finally {
    carregando.value = false
  }
}

async function recarregarVip() {
  vip.value = await listarVipProdutor(eventoId)
  evento.value = await obterEventoProdutor(eventoId)
}

async function adicionar() {
  if (!novoVip.value.trim()) {
    toast.error('Informe o nome do convidado.')
    return
  }
  salvandoVip.value = true
  try {
    await adicionarVipProdutor(eventoId, novoVip.value.trim(), obsVip.value.trim() || null)
    novoVip.value = ''
    obsVip.value = ''
    await recarregarVip()
    toast.success('Convidado adicionado.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível adicionar.')
  } finally {
    salvandoVip.value = false
  }
}

async function remover(item: VipProdutor) {
  if (!window.confirm(`Remover ${item.nome} da lista VIP?`)) return
  try {
    await removerVipProdutor(item.vipId)
    await recarregarVip()
    toast.success('Convidado removido.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Não foi possível remover.')
  }
}

async function baixar(formato: 'xlsx' | 'txt') {
  const aviso = toast.loading('Gerando lista de pagantes...')
  try {
    await baixarListaPagantesProdutor(eventoId, formato)
    toast.update(aviso, { render: 'Lista baixada.', type: 'success', isLoading: false, autoClose: 3000 })
  } catch (e) {
    toast.update(aviso, {
      render: e instanceof Error ? e.message : 'Não foi possível baixar a lista.',
      type: 'error',
      isLoading: false,
      autoClose: 5000
    })
  }
}

onMounted(() => void carregar())
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/produtor" class="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-amber-400">
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

    <template v-else-if="evento && sociedade">
      <div class="space-y-2">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="text-2xl font-semibold">{{ evento.nome }}</h1>
          <EventStatusBadge :status="evento.status as EventStatus" />
        </div>
        <p class="text-sm text-zinc-400">
          {{ formatDataHora(evento.inicioEm) }}<span v-if="evento.local"> · {{ evento.local }}</span>
        </p>
        <LinkVendaEvento :slug="evento.slug" :nome="evento.nome" class="max-w-xl pt-1" />
      </div>

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Vendidos</p>
          <p class="mt-1 text-xl font-semibold">{{ evento.vendidos }}</p>
        </div>
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Já entraram</p>
          <p class="mt-1 text-xl font-semibold">{{ evento.utilizados }}</p>
        </div>
        <div class="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Lista VIP</p>
          <p class="mt-1 text-xl font-semibold">{{ evento.vipEntraram }}/{{ evento.vipTotal }}</p>
          <p class="text-xs text-zinc-500">entraram</p>
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
        <h2 class="text-sm font-semibold uppercase tracking-[0.15em] text-zinc-400">Divisão das vendas</h2>
        <SociedadeDivisao :sociedade="sociedade" />
      </BaseCard>

      <BaseCard class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="inline-flex rounded-lg border border-zinc-800 p-1">
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
              :class="aba === 'vendas' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'"
              @click="aba = 'vendas'"
            >
              Vendas ({{ vendas.length }})
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide"
              :class="aba === 'vip' ? 'bg-amber-400 text-zinc-950' : 'text-zinc-400'"
              @click="aba = 'vip'"
            >
              Lista VIP ({{ vip.length }})
            </button>
          </div>
          <div v-if="aba === 'vendas'" class="flex flex-wrap gap-2">
            <AppButton variant="outline" size="sm" @click="baixar('xlsx')">
              <ArrowDownTrayIcon class="h-4 w-4" /> Excel
            </AppButton>
            <AppButton variant="outline" size="sm" @click="baixar('txt')">
              <ArrowDownTrayIcon class="h-4 w-4" /> Bloco de notas
            </AppButton>
          </div>
        </div>

        <!-- Vendas -->
        <template v-if="aba === 'vendas'">
          <p v-if="vendas.length === 0" class="text-sm text-zinc-500">Nenhuma venda confirmada ainda.</p>
          <ul v-else class="divide-y divide-zinc-800">
            <li v-for="venda in vendas" :key="venda.codigo" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-white">{{ venda.compradorNome }}</p>
                <p class="text-xs text-zinc-500">
                  {{ venda.codigo }} · {{ venda.quantidade }} {{ venda.quantidade === 1 ? 'ingresso' : 'ingressos' }}
                  · {{ venda.forma === 'ONLINE' ? 'Online' : 'Portaria' }}
                  <span v-if="venda.pagoEm"> · {{ formatDataHora(venda.pagoEm) }}</span>
                </p>
              </div>
              <p class="shrink-0 text-sm font-semibold text-zinc-200">{{ formatMoeda(venda.valorTotal) }}</p>
            </li>
          </ul>
        </template>

        <!-- VIP -->
        <template v-else>
          <form v-if="podeAlterarVip" class="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]" @submit.prevent="adicionar">
            <BaseInput v-model="novoVip" placeholder="Nome do convidado" />
            <BaseInput v-model="obsVip" placeholder="Observação (opcional)" />
            <AppButton type="submit" variant="primary" :disabled="salvandoVip">Adicionar</AppButton>
          </form>
          <p v-else class="text-sm text-zinc-500">O evento já foi encerrado: a lista VIP não pode mais ser alterada.</p>

          <p v-if="vip.length === 0" class="text-sm text-zinc-500">Nenhum convidado na lista.</p>
          <ul v-else class="divide-y divide-zinc-800">
            <li v-for="item in vip" :key="item.vipId" class="flex items-center justify-between gap-3 py-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-white">{{ item.nome }}</p>
                <p class="text-xs text-zinc-500">
                  <span v-if="item.entrou" class="text-green-400">Entrou<span v-if="item.entradaEm"> às {{ formatDataHora(item.entradaEm) }}</span></span>
                  <span v-else>Ainda não entrou</span>
                  <span v-if="item.observacao"> · {{ item.observacao }}</span>
                  <span v-if="!item.adicionadoPorMim"> · adicionado pela galeria</span>
                </p>
              </div>
              <button
                v-if="item.adicionadoPorMim && !item.entrou && podeAlterarVip"
                type="button"
                class="shrink-0 rounded-lg p-2 text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
                :aria-label="`Remover ${item.nome}`"
                @click="remover(item)"
              >
                <TrashIcon class="h-4 w-4" />
              </button>
            </li>
          </ul>
        </template>
      </BaseCard>
    </template>
  </div>
</template>
