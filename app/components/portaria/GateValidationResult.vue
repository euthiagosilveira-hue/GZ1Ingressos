<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import {
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  TicketIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import GateTicketSummary from '~/components/portaria/GateTicketSummary.vue'
import type { GateValidationResultData, GateValidationStatus } from '~/types/portaria'

const props = defineProps<{
  resultado: GateValidationResultData
}>()

const emit = defineEmits<{
  registrar: []
  proximo: []
}>()

interface Config {
  titulo: string
  descricao: string
  icone: Component
  corIcone: string
  corBorda: string
}

type StatusRenderizavel = Exclude<GateValidationStatus, 'PRONTO'>

const MAPA: Record<StatusRenderizavel, Config> = {
  VALIDO: {
    titulo: 'Ingresso válido',
    descricao: 'Confirme os dados e registre a entrada.',
    icone: TicketIcon,
    corIcone: 'text-amber-300',
    corBorda: 'border-amber-400/40'
  },
  LIBERADO: {
    titulo: 'Entrada liberada',
    descricao: 'Entrada registrada com sucesso.',
    icone: CheckCircleIcon,
    corIcone: 'text-green-300',
    corBorda: 'border-green-500/50'
  },
  JA_UTILIZADO: {
    titulo: 'Ingresso já utilizado',
    descricao: 'Este ingresso já foi utilizado e não pode ser registrado novamente.',
    icone: ExclamationTriangleIcon,
    corIcone: 'text-amber-300',
    corBorda: 'border-amber-400/40'
  },
  RESERVADO: {
    titulo: 'Pagamento pendente',
    descricao: 'Este ingresso ainda não foi liberado para entrada.',
    icone: ClockIcon,
    corIcone: 'text-amber-300',
    corBorda: 'border-amber-400/40'
  },
  INVALIDO: {
    titulo: 'Ingresso inválido',
    descricao: 'Não foi possível localizar um ingresso válido para este código.',
    icone: XCircleIcon,
    corIcone: 'text-red-300',
    corBorda: 'border-red-500/40'
  },
  CANCELADO: {
    titulo: 'Ingresso cancelado',
    descricao: 'Este ingresso foi cancelado e não pode ser utilizado.',
    icone: XCircleIcon,
    corIcone: 'text-red-300',
    corBorda: 'border-red-500/40'
  },
  EXPIRADO: {
    titulo: 'Ingresso expirado',
    descricao: 'Este ingresso expirou e não pode ser utilizado.',
    icone: ClockIcon,
    corIcone: 'text-red-300',
    corBorda: 'border-red-500/40'
  },
  EVENTO_INCORRETO: {
    titulo: 'Evento incorreto',
    descricao: 'O ingresso pertence a outro evento.',
    icone: ExclamationTriangleIcon,
    corIcone: 'text-red-300',
    corBorda: 'border-red-500/40'
  }
}

const config = computed(() => MAPA[props.resultado.status as StatusRenderizavel])
const podeRegistrar = computed(() => props.resultado.status === 'VALIDO')
</script>

<template>
  <div
    role="status"
    aria-live="polite"
    class="space-y-4 rounded-2xl border-2 bg-zinc-900 p-5"
    :class="config.corBorda"
  >
    <div class="flex items-center gap-4">
      <span
        class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950"
      >
        <component :is="config.icone" class="h-7 w-7" :class="config.corIcone" />
      </span>
      <div class="min-w-0">
        <p class="text-lg font-bold uppercase tracking-wide" :class="config.corIcone">
          {{ config.titulo }}
        </p>
        <p class="text-sm text-zinc-400">{{ config.descricao }}</p>
      </div>
    </div>

    <GateTicketSummary v-if="props.resultado.ingresso" :resultado="props.resultado" />

    <p
      v-if="props.resultado.status === 'EVENTO_INCORRETO' && props.resultado.eventoCorretoNome"
      class="text-sm text-zinc-400"
    >
      Evento correto:
      <span class="font-semibold text-zinc-200">{{ props.resultado.eventoCorretoNome }}</span>
    </p>

    <AppButton
      v-if="podeRegistrar"
      variant="primary"
      size="lg"
      block
      @click="emit('registrar')"
    >
      Registrar entrada
    </AppButton>

    <AppButton v-else variant="outline" size="lg" block @click="emit('proximo')">
      Validar próximo
    </AppButton>
  </div>
</template>
