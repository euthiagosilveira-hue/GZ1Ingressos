<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue3-toastify'
import {
  ChartBarIcon,
  ChevronDownIcon,
  ExclamationTriangleIcon,
  SparklesIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import { gerarResumoCaixaAgora, listarAvisosCaixa } from '~/services/admin/caixa'
import type { AvisoCaixa } from '~/types/caixa'
import { formatDataHora } from '~/utils/format'

// Avisos automaticos do caixa (todo dia 10h) e resumo da semana escrito pela
// IA (segunda 11h). Os mesmos chegam no celular pelas notificacoes.

const avisos = ref<AvisoCaixa[]>([])
const carregando = ref(true)
const erro = ref(false)
const gerando = ref(false)
const aberto = ref<string | null>(null)
const verTodos = ref(false)

const VISIVEIS = 4

const lista = computed(() => (verTodos.value ? avisos.value : avisos.value.slice(0, VISIVEIS)))

async function carregar() {
  carregando.value = true
  erro.value = false
  try {
    avisos.value = await listarAvisosCaixa(20)
    const resumo = avisos.value.find((a) => a.tipo === 'RESUMO_SEMANAL')
    if (resumo && avisos.value[0]?.id === resumo.id) aberto.value = resumo.id
  } catch {
    erro.value = true
  } finally {
    carregando.value = false
  }
}

async function gerarResumo() {
  gerando.value = true
  try {
    const r = await gerarResumoCaixaAgora()
    toast.success(r.ia ? 'Resumo da semana pronto.' : 'Resumo pronto (sem IA: confira a chave do Gemini).')
    await carregar()
  } catch {
    toast.error('Não foi possível gerar o resumo agora. Tente de novo em alguns minutos.')
  } finally {
    gerando.value = false
  }
}

function resumoDe(a: AvisoCaixa) {
  const [manchete, ...resto] = a.mensagem.split('\n\n')
  return { manchete: manchete ?? '', linhas: resto.join('\n\n').split('\n').filter((l) => l.trim()) }
}

onMounted(carregar)
</script>

<template>
  <section class="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-2 text-lg font-semibold text-white">
          <SparklesIcon class="h-5 w-5 text-amber-400" /> Avisos do caixa
        </h2>
        <p class="text-xs text-zinc-500">
          Todo dia às 10h o sistema confere o caixa. Toda segunda às 11h chega o resumo da semana.
        </p>
      </div>
      <AppButton variant="ghost" size="sm" :disabled="gerando" @click="gerarResumo">
        <ChartBarIcon class="h-4 w-4" /> {{ gerando ? 'Gerando...' : 'Gerar resumo agora' }}
      </AppButton>
    </div>

    <p v-if="carregando" class="text-sm text-zinc-500">Carregando...</p>
    <p v-else-if="erro" class="text-sm text-zinc-500">
      Não foi possível carregar os avisos. Se for a primeira vez, confira se o SQL do monitor do caixa já foi aplicado.
    </p>
    <p v-else-if="!avisos.length" class="text-sm text-zinc-500">Nenhum aviso por enquanto. Tudo certo no caixa.</p>

    <ul v-else class="divide-y divide-zinc-800">
      <li v-for="a in lista" :key="a.id" class="py-3 first:pt-0 last:pb-0">
        <template v-if="a.tipo === 'RESUMO_SEMANAL'">
          <button
            type="button"
            class="flex w-full cursor-pointer items-start gap-3 text-left"
            @click="aberto = aberto === a.id ? null : a.id"
          >
            <ChartBarIcon class="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium text-zinc-100">{{ a.titulo }}</p>
              <p class="text-sm text-zinc-300">{{ resumoDe(a).manchete }}</p>
            </div>
            <ChevronDownIcon class="mt-0.5 h-4 w-4 shrink-0 text-zinc-500 transition-transform" :class="aberto === a.id ? 'rotate-180' : ''" />
          </button>
          <div v-if="aberto === a.id" class="mt-2 space-y-1 pl-8">
            <p v-for="(linha, i) in resumoDe(a).linhas" :key="i" class="text-sm text-zinc-300">{{ linha }}</p>
            <p class="pt-1 text-xs text-zinc-500">Feito em {{ formatDataHora(a.atualizadoEm) }}</p>
          </div>
        </template>
        <div v-else class="flex items-start gap-3">
          <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-zinc-100">{{ a.titulo }}</p>
            <p class="text-sm text-zinc-400">{{ a.mensagem }}</p>
            <p class="text-xs text-zinc-500">{{ formatDataHora(a.criadoEm) }}</p>
          </div>
        </div>
      </li>
    </ul>

    <button
      v-if="avisos.length > VISIVEIS"
      type="button"
      class="cursor-pointer text-xs font-semibold text-amber-400 hover:text-amber-300"
      @click="verTodos = !verTodos"
    >
      {{ verTodos ? 'Mostrar menos' : `Ver todos (${avisos.length})` }}
    </button>
  </section>
</template>
