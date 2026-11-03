<script setup lang="ts">
import { onMounted, ref } from 'vue'

import EventStatusBadge from '~/components/eventos/EventStatusBadge.vue'
import { toast } from 'vue3-toastify'

import {
  listarEventosProdutor,
  obterStatusMercadoPagoProdutor,
  type StatusMercadoPagoProdutor
} from '~/services/produtor/eventos'
import type { EventStatus } from '~/types/evento'
import type { EventoProdutorItem } from '~/types/produtor'
import { formatDataHora } from '~/utils/format'

definePageMeta({
  layout: 'produtor-layout',
  middleware: ['produtor-auth']
})

useSeoMeta({ title: 'Meus eventos | GZ1 Ingresso' })

const route = useRoute()
const eventos = ref<EventoProdutorItem[]>([])
const mp = ref<StatusMercadoPagoProdutor | null>(null)

const MENSAGENS_MP: Record<string, { tipo: 'success' | 'error'; texto: string }> = {
  conectado: { tipo: 'success', texto: 'Mercado Pago conectado! O Pix dos seus eventos em sociedade cai na sua conta.' },
  erro: { tipo: 'error', texto: 'Não foi possível conectar o Mercado Pago. Tente de novo.' },
  expirado: { tipo: 'error', texto: 'A conexão demorou demais. Clique em "Conectar Mercado Pago" de novo.' },
  'sem-permissao': { tipo: 'error', texto: 'Entre com o seu login de produtor para conectar o Mercado Pago.' },
  indisponivel: { tipo: 'error', texto: 'A conexão com o Mercado Pago ainda não foi ativada pela galeria.' }
}

function avisarRetornoMp() {
  const codigo = typeof route.query.mp === 'string' ? route.query.mp : ''
  const msg = MENSAGENS_MP[codigo]
  if (!msg) return
  if (msg.tipo === 'success') toast.success(msg.texto)
  else toast.error(msg.texto)
  navigateTo('/produtor', { replace: true })
}
const carregando = ref(true)
const erro = ref('')

function pct(v: number): string {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  try {
    const [lista, status] = await Promise.all([
      listarEventosProdutor(),
      obterStatusMercadoPagoProdutor().catch(() => null)
    ])
    eventos.value = lista
    mp.value = status
  } catch (e) {
    erro.value = e instanceof Error ? e.message : 'Não foi possível carregar seus eventos.'
  } finally {
    carregando.value = false
  }
}

onMounted(() => {
  avisarRetornoMp()
  void carregar()
})
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold">Meus eventos</h1>
      <p class="mt-1 text-sm text-zinc-400">Eventos em sociedade com a Galeria Zero 1.</p>
    </div>

    <div
      v-if="!carregando && mp"
      class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4"
      :class="mp.conectado ? 'border-green-500/40 bg-green-500/5' : 'border-amber-400/50 bg-amber-400/5'"
    >
      <div class="min-w-0">
        <p class="text-sm font-semibold" :class="mp.conectado ? 'text-green-400' : 'text-amber-300'">
          {{ mp.conectado ? 'Mercado Pago conectado' : 'Conecte seu Mercado Pago' }}
        </p>
        <p class="mt-1 text-sm text-zinc-400">
          {{
            mp.conectado
              ? 'O Pix dos seus eventos em sociedade cai direto na sua conta. A parte da galeria é separada automaticamente.'
              : 'Para receber o Pix dos seus eventos direto na sua conta. Enquanto não conectar, a venda online desses eventos fica bloqueada.'
          }}
        </p>
      </div>
      <a
        href="/api/mercadopago/oauth/iniciar"
        class="inline-flex shrink-0 items-center justify-center rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
        :class="mp.conectado ? 'border border-zinc-700 text-zinc-300 hover:border-amber-400/60' : 'bg-amber-400 text-zinc-950 hover:bg-amber-300'"
      >
        {{ mp.conectado ? 'Reconectar' : 'Conectar Mercado Pago' }}
      </a>
    </div>

    <div v-if="carregando" class="space-y-3" aria-busy="true">
      <div v-for="n in 3" :key="n" class="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
    </div>

    <div v-else-if="erro" role="alert" class="space-y-3 rounded-2xl border border-red-500/40 bg-red-500/5 p-6 text-center">
      <p class="text-sm font-semibold text-red-300">{{ erro }}</p>
      <button type="button" class="text-xs font-semibold uppercase tracking-wide text-amber-400" @click="carregar">
        Tentar novamente
      </button>
    </div>

    <p
      v-else-if="eventos.length === 0"
      class="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center text-sm text-zinc-400"
    >
      Você ainda não está em nenhum evento. Quando a galeria incluir você, ele aparece aqui.
    </p>

    <ul v-else class="space-y-3">
      <li v-for="evento in eventos" :key="evento.eventoId">
        <NuxtLink
          :to="`/produtor/eventos/${evento.eventoId}`"
          class="flex gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-colors hover:border-amber-400/50"
        >
          <img
            v-if="evento.imagemUrl"
            :src="evento.imagemUrl"
            alt=""
            class="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate font-semibold text-white">{{ evento.nome }}</p>
              <EventStatusBadge :status="evento.status as EventStatus" />
            </div>
            <p class="text-sm text-zinc-400">{{ formatDataHora(evento.inicioEm) }}</p>
            <p class="text-sm text-zinc-300">
              {{ evento.vendidos }} ingressos vendidos · sua parte: {{ pct(evento.percentualProdutor) }}
            </p>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
