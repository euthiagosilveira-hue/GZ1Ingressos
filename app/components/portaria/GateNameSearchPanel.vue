<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  TicketIcon,
  XCircleIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseCard from '~/components/BaseCard.vue'
import { useGateNameSearch } from '~/composables/useGateNameSearch'
import type { GateScanErroCode, IngressoBuscaNome } from '~/types/gate'
import { formatDataHoraCompleta } from '~/utils/format'
import { descricaoResultadoEntrada, rotuloResultadoEntrada, uuidValido } from '~/utils/gate'

const props = defineProps<{
  eventoId: string
}>()

const {
  nome,
  buscando,
  registrando,
  resultados,
  resultado,
  erro,
  jaBuscou,
  podeBuscar,
  buscar,
  registrar,
  reset
} = useGateNameSearch(() => props.eventoId)

const temEvento = computed(() => uuidValido(props.eventoId))

const MENSAGENS_ERRO: Record<GateScanErroCode, string> = {
  SEM_EVENTO: 'Selecione um evento para buscar ingressos.',
  SEM_PERMISSAO: 'Sessão de operador de portaria necessária. Entre com um usuário autorizado.',
  QR_INVALIDO: 'Código inválido.',
  ERRO_TEMPORARIO: 'Não foi possível concluir a busca agora. Tente novamente.'
}

const rotulo = computed(() =>
  resultado.value ? rotuloResultadoEntrada(resultado.value.resultado) : null
)

const descricaoResultado = computed(() =>
  resultado.value
    ? descricaoResultadoEntrada(resultado.value.resultado, resultado.value.mensagem)
    : ''
)

const ROTULOS_STATUS: Record<string, string> = {
  VALIDO: 'Válido',
  UTILIZADO: 'Utilizado',
  RESERVADO: 'Reservado',
  CANCELADO: 'Cancelado',
  EXPIRADO: 'Expirado'
}

function rotuloStatus(status: string): string {
  return ROTULOS_STATUS[status] ?? status
}

function elegivel(ingresso: IngressoBuscaNome): boolean {
  return ingresso.status === 'VALIDO'
}
</script>

<template>
  <BaseCard class="space-y-4">
    <!-- Sem evento -->
    <div
      v-if="!temEvento"
      class="rounded-2xl border border-dashed border-zinc-700 bg-zinc-950 p-6 text-center"
    >
      <MagnifyingGlassIcon class="mx-auto h-12 w-12 text-zinc-700" />
      <p class="mt-3 text-sm text-zinc-400">Selecione um evento para buscar ingressos.</p>
    </div>

    <!-- Resultado de registro -->
    <div
      v-else-if="resultado || (erro && erro !== 'SEM_EVENTO')"
      role="status"
      aria-live="assertive"
      class="space-y-4 rounded-2xl border-2 bg-zinc-950 p-5"
      :class="rotulo?.sucesso ? 'border-green-500/60' : 'border-red-500/50'"
    >
      <div class="flex items-center gap-4">
        <span
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900"
        >
          <CheckCircleIcon v-if="rotulo?.sucesso" class="h-7 w-7 text-green-300" />
          <XCircleIcon v-else class="h-7 w-7 text-red-300" />
        </span>
        <div class="min-w-0">
          <p
            class="text-lg font-bold uppercase tracking-wide"
            :class="rotulo?.sucesso ? 'text-green-300' : 'text-red-300'"
          >
            {{ rotulo ? rotulo.titulo : 'Não foi possível registrar' }}
          </p>
          <p class="text-sm text-zinc-400">
            {{ erro && !resultado ? MENSAGENS_ERRO[erro] : descricaoResultado }}
          </p>
        </div>
      </div>

      <dl
        v-if="resultado && (resultado.participanteNome || resultado.codigo)"
        class="space-y-1 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-sm"
      >
        <div v-if="resultado.participanteNome" class="flex justify-between gap-3">
          <dt class="text-zinc-500">Participante</dt>
          <dd class="text-right font-semibold text-zinc-100">{{ resultado.participanteNome }}</dd>
        </div>
        <div v-if="resultado.codigo" class="flex justify-between gap-3">
          <dt class="text-zinc-500">Ingresso</dt>
          <dd class="text-zinc-200">{{ resultado.codigo }}</dd>
        </div>
        <div v-if="resultado.entradaEm" class="flex justify-between gap-3">
          <dt class="text-zinc-500">Entrada</dt>
          <dd class="text-zinc-200">{{ formatDataHoraCompleta(resultado.entradaEm) }}</dd>
        </div>
      </dl>

      <AppButton variant="primary" size="lg" block @click="reset">Nova busca</AppButton>
    </div>

    <!-- Busca -->
    <template v-else>
      <form class="space-y-3" @submit.prevent="buscar">
        <div class="space-y-1.5">
          <label for="gate-nome" class="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Nome do participante
          </label>
          <input
            id="gate-nome"
            v-model="nome"
            type="text"
            autocomplete="off"
            class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            placeholder="Digite o nome completo"
          />
          <p v-if="nome.length > 0 && !nomeValido" class="text-xs text-zinc-500">
            Informe o nome completo (mínimo 2 caracteres).
          </p>
        </div>

        <AppButton type="submit" variant="primary" size="lg" block :disabled="!podeBuscar || buscando">
          {{ buscando ? 'Buscando...' : 'Buscar' }}
        </AppButton>
      </form>

      <p v-if="erro === 'SEM_EVENTO'" class="text-sm text-zinc-400">
        Selecione um evento para buscar ingressos.
      </p>

      <p v-else-if="erro" role="alert" class="text-sm text-red-300">
        {{ MENSAGENS_ERRO[erro] }}
      </p>

      <div v-if="jaBuscou && !buscando && resultados.length === 0 && !erro" class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center text-sm text-zinc-400">
        Nenhum ingresso encontrado com esse nome neste evento.
      </div>

      <ul v-if="resultados.length > 0" class="space-y-3" aria-live="polite">
        <li v-for="ingresso in resultados" :key="ingresso.ingressoId">
          <div class="flex items-center justify-between gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div class="min-w-0">
              <p class="truncate text-sm font-semibold text-white">{{ ingresso.participanteNome }}</p>
              <p class="text-xs text-zinc-500">Ingresso {{ ingresso.codigo }}</p>
              <span class="mt-1 inline-flex items-center rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
                {{ rotuloStatus(ingresso.status) }}
              </span>
            </div>
            <AppButton
              v-if="elegivel(ingresso)"
              variant="primary"
              :disabled="registrando"
              @click="registrar(ingresso)"
            >
              <TicketIcon class="h-4 w-4" />
              Registrar
            </AppButton>
          </div>
        </li>
      </ul>
    </template>
  </BaseCard>
</template>
