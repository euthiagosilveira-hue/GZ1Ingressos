<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeftIcon, PlusIcon } from '@heroicons/vue/24/outline'
import { toast } from 'vue3-toastify'

import AppButton from '~/components/AppButton.vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import PageHeader from '~/components/PageHeader.vue'
import LotDetailsModal from '~/components/lotes/LotDetailsModal.vue'
import LotEventHeader from '~/components/lotes/LotEventHeader.vue'
import LotFormModal from '~/components/lotes/LotFormModal.vue'
import LotGrid from '~/components/lotes/LotGrid.vue'
import { buscarEstoqueAntecipado, buscarLotesMock } from '~/data/lotes'
import type { EventListItem } from '~/types/evento'
import type {
  LotFormMode,
  LotFormValue,
  LotListItem,
  LotOrdemRef,
  LotPayload
} from '~/types/lote'
import { proximaOrdem } from '~/utils/lotes'

const props = defineProps<{
  evento: EventListItem
}>()

const lotes = ref<LotListItem[]>(buscarLotesMock(props.evento.id))
const estoqueAntecipado = buscarEstoqueAntecipado(props.evento.id)

const formAberto = ref(false)
const formModo = ref<LotFormMode>('create')
const loteEmEdicao = ref<LotListItem | null>(null)

const loteParaAtivar = ref<LotListItem | null>(null)
const loteParaEncerrar = ref<LotListItem | null>(null)
const loteDetalhes = ref<LotListItem | null>(null)

const lotesOrdenados = computed(() => [...lotes.value].sort((a, b) => a.ordem - b.ordem))
const ordens = computed<LotOrdemRef[]>(() =>
  lotes.value.map((lote) => ({ id: lote.id, ordem: lote.ordem }))
)
const totalLotes = computed(() => lotes.value.length)
const lotesAtivos = computed(() => lotes.value.filter((lote) => lote.status === 'ATIVO').length)
const vendidos = computed(() => lotes.value.reduce((total, lote) => total + lote.vendidos, 0))
const disponiveis = computed(() => lotes.value.reduce((total, lote) => total + lote.disponiveis, 0))
const precoAtual = computed(() => {
  const ativo = lotes.value.find((lote) => lote.status === 'ATIVO')
  return ativo ? ativo.preco : null
})

const valorInicialForm = computed<Partial<LotFormValue>>(() => {
  if (formModo.value === 'edit' && loteEmEdicao.value) {
    const lote = loteEmEdicao.value
    return {
      nome: lote.nome,
      ordem: lote.ordem,
      quantidade: lote.quantidade,
      preco: lote.preco,
      tipoAtivacao: lote.tipoAtivacao,
      dataAtivacao: lote.ativacaoEm ? lote.ativacaoEm.slice(0, 10) : '',
      horaAtivacao: lote.ativacaoEm ? lote.ativacaoEm.slice(11, 16) : '',
      status: lote.status
    }
  }
  return {
    ordem: proximaOrdem(lotes.value),
    tipoAtivacao: 'MANUAL',
    status: 'INATIVO'
  }
})

function abrirNovo() {
  formModo.value = 'create'
  loteEmEdicao.value = null
  formAberto.value = true
}

function abrirEdicao(id: string) {
  const lote = lotes.value.find((item) => item.id === id)
  if (!lote) return
  formModo.value = 'edit'
  loteEmEdicao.value = lote
  formAberto.value = true
}

function fecharForm() {
  formAberto.value = false
  loteEmEdicao.value = null
}

function salvar(payload: LotPayload) {
  if (formModo.value === 'create') {
    lotes.value = [
      ...lotes.value,
      {
        id: `lote_${Date.now()}`,
        eventoId: props.evento.id,
        nome: payload.nome,
        ordem: payload.ordem,
        quantidade: payload.quantidade,
        preco: payload.preco,
        tipoAtivacao: payload.tipoAtivacao,
        ativacaoEm: payload.ativacaoEm,
        ativadoEm: null,
        encerradoEm: null,
        status: 'INATIVO',
        vendidos: 0,
        disponiveis: payload.quantidade
      }
    ]
    toast.success('Lote criado com sucesso!')
  } else if (loteEmEdicao.value) {
    const id = loteEmEdicao.value.id
    lotes.value = lotes.value.map((lote) =>
      lote.id === id
        ? {
            ...lote,
            nome: payload.nome,
            ordem: payload.ordem,
            quantidade: payload.quantidade,
            preco: payload.preco,
            tipoAtivacao: payload.tipoAtivacao,
            ativacaoEm: payload.ativacaoEm,
            disponiveis: Math.max(payload.quantidade - lote.vendidos, 0)
          }
        : lote
    )
    toast.success('Lote atualizado com sucesso!')
  }
  fecharForm()
}

function solicitarAtivacao(id: string) {
  loteParaAtivar.value = lotes.value.find((item) => item.id === id) ?? null
}

function confirmarAtivacao() {
  const alvo = loteParaAtivar.value
  if (!alvo) return
  const agora = new Date().toISOString()
  lotes.value = lotes.value.map((lote) => {
    if (lote.id === alvo.id) {
      return { ...lote, status: 'ATIVO', ativadoEm: agora, encerradoEm: null }
    }
    if (lote.status === 'ATIVO') {
      return { ...lote, status: 'ENCERRADO', encerradoEm: agora }
    }
    return lote
  })
  toast.success(`${alvo.nome} ativado.`)
  loteParaAtivar.value = null
}

function solicitarEncerramento(id: string) {
  loteParaEncerrar.value = lotes.value.find((item) => item.id === id) ?? null
}

function confirmarEncerramento() {
  const alvo = loteParaEncerrar.value
  if (!alvo) return
  const agora = new Date().toISOString()
  lotes.value = lotes.value.map((lote) =>
    lote.id === alvo.id ? { ...lote, status: 'ENCERRADO', encerradoEm: agora } : lote
  )
  toast.success(`${alvo.nome} encerrado.`)
  loteParaEncerrar.value = null
}

function acaoLote(payload: { id: string; action: string }) {
  switch (payload.action) {
    case 'editar':
      abrirEdicao(payload.id)
      break
    case 'ativar':
      solicitarAtivacao(payload.id)
      break
    case 'encerrar':
      solicitarEncerramento(payload.id)
      break
    case 'detalhes':
      loteDetalhes.value = lotes.value.find((item) => item.id === payload.id) ?? null
      break
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-3">
      <NuxtLink
        to="/eventos"
        class="inline-flex w-fit items-center gap-2 text-sm text-zinc-400 transition-colors duration-150 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
      >
        <ArrowLeftIcon class="h-4 w-4" />
        Voltar para eventos
      </NuxtLink>

      <nav class="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500" aria-label="Breadcrumb">
        <NuxtLink to="/eventos" class="transition-colors hover:text-zinc-300">Eventos</NuxtLink>
        <span aria-hidden="true">/</span>
        <span class="max-w-[12rem] truncate text-zinc-400">{{ props.evento.nome }}</span>
        <span aria-hidden="true">/</span>
        <span class="text-zinc-400">Lotes</span>
      </nav>
    </div>

    <PageHeader title="Lotes" subtitle="Gerencie os preços e as etapas de venda deste evento.">
      <template #actions>
        <AppButton variant="primary" @click="abrirNovo">
          <PlusIcon class="h-4 w-4" />
          Novo lote
        </AppButton>
      </template>
    </PageHeader>

    <LotEventHeader
      :evento="props.evento"
      :estoque-antecipado="estoqueAntecipado"
      :vendidos="vendidos"
      :disponiveis="disponiveis"
      :total-lotes="totalLotes"
      :lotes-ativos="lotesAtivos"
      :preco-atual="precoAtual"
    />

    <LotGrid :lotes="lotesOrdenados" @action="acaoLote" @create="abrirNovo" />

    <LotFormModal
      :open="formAberto"
      :mode="formModo"
      :initial-value="valorInicialForm"
      :ordens="ordens"
      :id-atual="loteEmEdicao?.id ?? ''"
      @submit="salvar"
      @cancel="fecharForm"
    />

    <LotDetailsModal
      :open="loteDetalhes !== null"
      :lote="loteDetalhes"
      @close="loteDetalhes = null"
    />

    <ConfirmDialog
      :open="loteParaAtivar !== null"
      :title="`Ativar ${loteParaAtivar?.nome ?? ''}?`"
      description="O lote atualmente ativo será encerrado e este passará a ser o lote vigente."
      confirm-label="Ativar lote"
      @confirm="confirmarAtivacao"
      @cancel="loteParaAtivar = null"
    />

    <ConfirmDialog
      :open="loteParaEncerrar !== null"
      tone="danger"
      :title="`Encerrar ${loteParaEncerrar?.nome ?? ''}?`"
      description="O lote será encerrado e não poderá ser reaberto."
      confirm-label="Encerrar lote"
      @confirm="confirmarEncerramento"
      @cancel="loteParaEncerrar = null"
    />
  </div>
</template>
