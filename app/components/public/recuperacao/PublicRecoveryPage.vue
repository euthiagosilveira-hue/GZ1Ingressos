<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ChevronRightIcon, ExclamationTriangleIcon, TicketIcon } from '@heroicons/vue/24/outline'

import { recuperarIngressosPorContato, type PedidoRecuperado } from '~/services/public/recuperacao'
import { formatarTelefone } from '~/utils/checkout'
import { armazenamentoNavegador, lerIngressosSalvos, type IngressoSalvo } from '~/utils/ingressosSalvos'
import { normalizarEmail, normalizarTelefone } from '~/utils/publicIngressos'

const form = reactive({ telefone: '', email: '' })
const carregando = ref(false)
const erro = ref('')
const encontrados = ref<PedidoRecuperado[]>([])
const salvos = ref<IngressoSalvo[]>([])

onMounted(() => {
  salvos.value = lerIngressosSalvos(armazenamentoNavegador())
})

const podeEnviar = computed(
  () => normalizarTelefone(form.telefone).length >= 10 && normalizarEmail(form.email).includes('@')
)

function formatarData(valor: string | null): string {
  if (!valor) return ''
  const data = new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function rotuloQuantidade(qtd: number): string {
  return qtd === 1 ? '1 ingresso' : `${qtd} ingressos`
}

async function enviar() {
  erro.value = ''
  encontrados.value = []
  if (!podeEnviar.value) {
    erro.value = 'Informe o telefone e o e-mail usados na compra.'
    return
  }

  carregando.value = true
  try {
    const pedidos = await recuperarIngressosPorContato({
      telefone: form.telefone,
      email: form.email
    })
    if (pedidos.length === 0) {
      erro.value =
        'Não encontramos compra paga com esse telefone e e-mail. Confira se são os mesmos usados na compra.'
      return
    }
    if (pedidos.length === 1) {
      await navigateTo({ path: '/meus-ingressos', query: { recovery: pedidos[0].token } })
      return
    }
    encontrados.value = pedidos
  } catch {
    erro.value = 'Não foi possível recuperar agora. Tente novamente.'
  } finally {
    carregando.value = false
  }
}
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-10 text-white">
    <section class="w-full max-w-md space-y-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
      <header class="space-y-3 text-center">
        <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-700 bg-zinc-950">
          <TicketIcon class="h-6 w-6 text-amber-400" />
        </span>
        <h1 class="text-lg font-bold uppercase tracking-wide text-amber-400">Meus ingressos</h1>
        <p class="text-sm text-zinc-400">
          Informe o telefone e o e-mail usados na compra para acessar seus ingressos.
        </p>
      </header>

      <div v-if="salvos.length" class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Salvos neste aparelho</p>
        <NuxtLink
          v-for="item in salvos"
          :key="item.checkoutToken"
          :to="{ path: '/meus-ingressos', query: { token: item.checkoutToken } }"
          class="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 transition-colors hover:border-amber-400/60"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold text-zinc-100">{{ item.eventoNome }}</span>
            <span class="block text-xs text-zinc-500">
              Pedido {{ item.codigoPedido }}<template v-if="item.eventoInicioEm"> · {{ formatarData(item.eventoInicioEm) }}</template>
            </span>
          </span>
          <ChevronRightIcon class="h-5 w-5 shrink-0 text-zinc-500" />
        </NuxtLink>
      </div>

      <p
        v-if="erro"
        role="alert"
        class="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/5 p-3 text-sm text-red-300"
      >
        <ExclamationTriangleIcon class="mt-0.5 h-5 w-5 shrink-0" />
        <span>{{ erro }}</span>
      </p>

      <div v-if="encontrados.length" class="space-y-2">
        <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Escolha a compra</p>
        <NuxtLink
          v-for="pedido in encontrados"
          :key="pedido.token"
          :to="{ path: '/meus-ingressos', query: { recovery: pedido.token } }"
          class="flex items-center justify-between gap-3 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 transition-colors hover:border-amber-400/60"
        >
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold text-zinc-100">{{ pedido.eventoNome }}</span>
            <span class="block text-xs text-zinc-500">
              {{ rotuloQuantidade(pedido.quantidade) }}<template v-if="pedido.eventoInicioEm"> · {{ formatarData(pedido.eventoInicioEm) }}</template>
            </span>
          </span>
          <ChevronRightIcon class="h-5 w-5 shrink-0 text-zinc-500" />
        </NuxtLink>
      </div>

      <form class="space-y-4" @submit.prevent="enviar">
        <div class="space-y-1.5">
          <label for="telefone" class="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Telefone usado na compra
          </label>
          <input
            id="telefone"
            :value="form.telefone"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            placeholder="(11) 99999-0000"
            @input="form.telefone = formatarTelefone(($event.target as HTMLInputElement).value)"
          />
        </div>

        <div class="space-y-1.5">
          <label for="email" class="block text-xs font-semibold uppercase tracking-wide text-zinc-400">
            E-mail usado na compra
          </label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            autocomplete="email"
            class="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            placeholder="voce@email.com"
          />
        </div>

        <button
          type="submit"
          :disabled="carregando"
          class="flex w-full items-center justify-center rounded-xl bg-amber-400 px-6 py-4 text-sm font-bold uppercase tracking-wide text-zinc-950 transition-colors duration-150 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 disabled:pointer-events-none disabled:opacity-50"
        >
          {{ carregando ? 'Buscando...' : 'Recuperar ingressos' }}
        </button>
      </form>

      <NuxtLink
        to="/eventos-publicos"
        class="block text-center text-xs font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-300"
      >
        Ver eventos
      </NuxtLink>
    </section>
  </main>
</template>
