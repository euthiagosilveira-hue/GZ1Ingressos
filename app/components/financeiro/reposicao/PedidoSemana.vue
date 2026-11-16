<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue3-toastify'
import { CheckCircleIcon, DocumentDuplicateIcon, ShoppingCartIcon } from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import {
  descartarPedidoReposicao,
  finalizarPedidoReposicao,
  iniciarPedidoReposicao,
  obterConsumoBar,
  obterPedidoAbertoReposicao,
  salvarItemPedidoReposicao
} from '~/services/admin/reposicao'
import type { ConsumoBar, ItemPedidoReposicao, PedidoReposicao } from '~/types/reposicao'
import type { SelectOption } from '~/types/ui'
import { formatarDataCurta, hojeIso } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'
import {
  agruparPorFornecedor,
  faltaPedir,
  lerQuantidade,
  mensagemErroReposicao,
  mensagemPedido,
  quantidadeParaTexto,
  descreverEmbalagem,
  estoqueTotal,
  nomeEmbalagem,
  sugerirQuantidade,
  unidadeComPlural,
  unidadesComEmbalagens,
  totalEstimado,
  valorEstimado
} from '~/utils/reposicao'

// Pedido da semana: o que tem hoje -> quanto pedir -> manda para o fornecedor
// -> marca o que ja foi pedido.

const emit = defineEmits<{ irParaProdutos: []; finalizou: [] }>()

const pedido = ref<PedidoReposicao | null>(null)
const carregando = ref(true)
const erro = ref('')
const iniciando = ref(false)

// Texto digitado em cada campo (para nao "pular" enquanto a pessoa digita).
// Produto em fardo/caixa: textoFechados = embalagens fechadas, textoEstoque = soltas.
// Produto avulso: so textoEstoque (total).
const textoEstoque = ref<Record<string, string>>({})
const textoFechados = ref<Record<string, string>>({})
const textoQuantidade = ref<Record<string, string>>({})
const invalidos = ref<Record<string, boolean>>({})

function prepararTextos(p: PedidoReposicao | null) {
  textoEstoque.value = {}
  textoFechados.value = {}
  textoQuantidade.value = {}
  invalidos.value = {}
  for (const i of p?.itens ?? []) {
    if (i.unidadesPorEmbalagem > 1) {
      textoFechados.value[i.id] = quantidadeParaTexto(i.estoqueFechados)
      // Total antigo sem fechados/soltos: mostra como soltas.
      textoEstoque.value[i.id] = quantidadeParaTexto(
        i.estoqueFechados === null && i.estoqueSoltos === null ? i.estoqueAtual : i.estoqueSoltos
      )
    } else {
      textoEstoque.value[i.id] = quantidadeParaTexto(i.estoqueAtual)
    }
    textoQuantidade.value[i.id] = i.quantidade > 0 ? quantidadeParaTexto(i.quantidade) : ''
  }
}

// Quanto saiu no bar por semana (relatorios do bar ligados aos produtos).
const consumo = ref<ConsumoBar | null>(null)

function consumoDe(id: string | null) {
  return id ? (consumo.value?.porProduto[id] ?? null) : null
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  obterConsumoBar(4)
    .then((c) => (consumo.value = c))
    .catch(() => (consumo.value = null))
  try {
    pedido.value = await obterPedidoAbertoReposicao()
    prepararTextos(pedido.value)
  } catch (e) {
    erro.value = mensagemErroReposicao(e, 'Não foi possível carregar o pedido.')
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)
defineExpose({ carregar })

async function iniciar() {
  iniciando.value = true
  try {
    pedido.value = await iniciarPedidoReposicao()
    prepararTextos(pedido.value)
  } catch (e) {
    toast.error(mensagemErroReposicao(e, 'Não foi possível montar o pedido.'))
  } finally {
    iniciando.value = false
  }
}

// --- Salvar item (com espera curta enquanto digita) -----------------------
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const salvandoIds = new Set<string>()
const salvarDeNovo = new Set<string>()
const pendentes = ref(0)

function agendarSalvar(item: ItemPedidoReposicao, espera = 700) {
  clearTimeout(timers.get(item.id))
  timers.set(
    item.id,
    setTimeout(() => {
      timers.delete(item.id)
      void salvarAgora(item)
    }, espera)
  )
}

async function salvarAgora(item: ItemPedidoReposicao) {
  if (salvandoIds.has(item.id)) {
    salvarDeNovo.add(item.id)
    return
  }
  salvandoIds.add(item.id)
  pendentes.value++
  try {
    await salvarItemPedidoReposicao({
      id: item.id,
      estoqueAtual: item.estoqueAtual,
      estoqueFechados: item.unidadesPorEmbalagem > 1 ? item.estoqueFechados : null,
      estoqueSoltos: item.unidadesPorEmbalagem > 1 ? item.estoqueSoltos : null,
      quantidade: item.quantidade,
      pedidoFeito: item.pedidoFeito
    })
  } catch (e) {
    toast.error(mensagemErroReposicao(e, `Não foi possível salvar "${item.nome}".`))
  } finally {
    salvandoIds.delete(item.id)
    pendentes.value--
    if (salvarDeNovo.delete(item.id)) void salvarAgora(item)
  }
}

async function salvarTudoPendente() {
  const ids = [...timers.keys()]
  for (const id of ids) {
    clearTimeout(timers.get(id))
    timers.delete(id)
    const item = pedido.value?.itens.find((i) => i.id === id)
    if (item) await salvarAgora(item)
  }
}

onBeforeUnmount(() => {
  void salvarTudoPendente()
})

function aoDigitarEstoque(item: ItemPedidoReposicao, texto: string, campo: 'soltos' | 'fechados' = 'soltos') {
  const chave = campo === 'fechados' ? `f-${item.id}` : `e-${item.id}`
  if (campo === 'fechados') textoFechados.value[item.id] = texto
  else textoEstoque.value[item.id] = texto
  const lido = lerQuantidade(texto)
  if (lido !== null && Number.isNaN(lido)) {
    invalidos.value[chave] = true
    return
  }
  invalidos.value[chave] = false
  let v: number | null
  if (item.unidadesPorEmbalagem > 1) {
    if (campo === 'fechados') item.estoqueFechados = lido
    else item.estoqueSoltos = lido
    v = estoqueTotal(item.estoqueFechados, item.estoqueSoltos, item.unidadesPorEmbalagem)
  } else {
    v = lido
  }
  item.estoqueAtual = v
  // Recalcula a sugestao (a pessoa pode ajustar depois no campo "Pedir").
  const sugestao = sugerirQuantidade(item.quantidadeIdeal, v, item.unidadesPorEmbalagem)
  if (v !== null || item.quantidade === 0) {
    item.quantidade = sugestao
    textoQuantidade.value[item.id] = sugestao > 0 ? quantidadeParaTexto(sugestao) : ''
    invalidos.value[`q-${item.id}`] = false
  }
  if (item.quantidade === 0) item.pedidoFeito = false
  agendarSalvar(item)
}

function aoDigitarQuantidade(item: ItemPedidoReposicao, texto: string) {
  textoQuantidade.value[item.id] = texto
  const v = lerQuantidade(texto)
  if (v !== null && Number.isNaN(v)) {
    invalidos.value[`q-${item.id}`] = true
    return
  }
  invalidos.value[`q-${item.id}`] = false
  item.quantidade = v ?? 0
  if (item.quantidade === 0) item.pedidoFeito = false
  agendarSalvar(item)
}

function alternarPedido(item: ItemPedidoReposicao) {
  if (item.quantidade <= 0) return
  item.pedidoFeito = !item.pedidoFeito
  agendarSalvar(item, 0)
}

function marcarFornecedor(itens: ItemPedidoReposicao[], valor: boolean) {
  for (const item of itens) {
    if (item.quantidade > 0 && item.pedidoFeito !== valor) {
      item.pedidoFeito = valor
      agendarSalvar(item, 0)
    }
  }
}

// --- Visao -----------------------------------------------------------------
const filtro = ref<'todos' | 'pedir' | 'falta'>('todos')
const filtroOptions: SelectOption[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pedir', label: 'Vou pedir' },
  { value: 'falta', label: 'Falta pedir' }
]

const itens = computed(() => pedido.value?.itens ?? [])
const comQuantidade = computed(() => itens.value.filter((i) => i.quantidade > 0))
const falta = computed(() => faltaPedir(itens.value))
const total = computed(() => totalEstimado(itens.value))
const semPreco = computed(() => comQuantidade.value.filter((i) => i.preco === null).length)

const grupos = computed(() => {
  const visiveis = itens.value.filter((i) =>
    filtro.value === 'pedir' ? i.quantidade > 0 : filtro.value === 'falta' ? i.quantidade > 0 && !i.pedidoFeito : true
  )
  return agruparPorFornecedor(visiveis).map((g) => {
    const todosDoFornecedor = itens.value.filter(
      (i) => (i.fornecedor ?? '').toLowerCase() === (g.fornecedor ?? '').toLowerCase()
    )
    const pedir = todosDoFornecedor.filter((i) => i.quantidade > 0)
    return {
      ...g,
      pedir,
      total: totalEstimado(pedir),
      tudoPedido: pedir.length > 0 && pedir.every((i) => i.pedidoFeito)
    }
  })
})

const dataPedido = computed(() => formatarDataCurta(hojeIso()))

function textoFornecedor(fornecedor: string | null, pedir: ItemPedidoReposicao[]) {
  return mensagemPedido(pedir, { fornecedor, data: dataPedido.value })
}

function linkWhatsapp(texto: string) {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success('Pedido copiado.')
  } catch {
    toast.error('Não foi possível copiar.')
  }
}

// --- Finalizar / descartar ------------------------------------------------
const confirmarFinalizar = ref(false)
const confirmarDescartar = ref(false)
const finalizando = ref(false)

const descricaoFinalizar = computed(() => {
  const base = 'O pedido vai para "Pedidos anteriores" e na próxima semana você começa um novo.'
  if (!falta.value.length) return base
  return `${base} Atenção: ${falta.value.length} ${falta.value.length === 1 ? 'item ainda não foi marcado' : 'itens ainda não foram marcados'} como pedido.`
})

async function finalizar() {
  if (!pedido.value) return
  finalizando.value = true
  try {
    await salvarTudoPendente()
    await finalizarPedidoReposicao(pedido.value.id)
    toast.success('Pedido da semana finalizado.')
    confirmarFinalizar.value = false
    pedido.value = null
    emit('finalizou')
  } catch (e) {
    toast.error(mensagemErroReposicao(e, 'Não foi possível finalizar.'))
  } finally {
    finalizando.value = false
  }
}

async function descartar() {
  if (!pedido.value) return
  finalizando.value = true
  try {
    timers.forEach((t) => clearTimeout(t))
    timers.clear()
    await descartarPedidoReposicao(pedido.value.id)
    toast.success('Pedido descartado.')
    confirmarDescartar.value = false
    pedido.value = null
  } catch (e) {
    toast.error(mensagemErroReposicao(e, 'Não foi possível descartar.'))
  } finally {
    finalizando.value = false
  }
}

// Nome pequeno dentro do campo (ex.: FARDOS), a esquerda; o numero fica a direita.
const rotuloCampo =
  'pointer-events-none absolute inset-y-0 left-2.5 flex max-w-[3.75rem] items-center truncate text-[10px] uppercase text-zinc-500'
const campo =
  'w-full rounded-lg border bg-zinc-950 px-2.5 py-2 text-right text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400/30'
</script>

<template>
  <div class="space-y-4">
    <p v-if="erro" class="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{{ erro }}</p>

    <div v-if="carregando" class="flex items-center gap-3 p-6 text-sm text-zinc-400">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" aria-hidden="true" />
      Carregando...
    </div>

    <!-- Nenhum pedido aberto -->
    <div
      v-else-if="!pedido && !erro"
      class="flex flex-col items-center gap-4 rounded-xl border border-dashed border-zinc-800 p-8 text-center"
    >
      <ShoppingCartIcon class="h-10 w-10 text-zinc-600" />
      <div>
        <p class="font-medium text-zinc-100">Nenhum pedido em aberto</p>
        <p class="mt-1 text-sm text-zinc-400">
          Comece o pedido da semana: a lista abre com todos os produtos, você coloca quanto tem hoje e o sistema sugere
          quanto pedir.
        </p>
      </div>
      <div class="flex flex-wrap justify-center gap-2">
        <AppButton variant="primary" :disabled="iniciando" @click="iniciar">
          {{ iniciando ? 'Montando...' : 'Montar pedido da semana' }}
        </AppButton>
        <AppButton variant="ghost" @click="emit('irParaProdutos')">Ver produtos</AppButton>
      </div>
    </div>

    <template v-else-if="pedido">
      <!-- Resumo -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Total estimado</p>
          <p class="mt-1 text-xl font-semibold text-white">{{ formatMoeda(total) }}</p>
          <p v-if="semPreco" class="text-[11px] text-zinc-500">{{ semPreco }} sem preço</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Itens a pedir</p>
          <p class="mt-1 text-xl font-semibold text-white">{{ comQuantidade.length }}</p>
          <p class="text-[11px] text-zinc-500">de {{ itens.length }} produtos</p>
        </div>
        <div class="rounded-xl border p-4" :class="falta.length ? 'border-amber-400/40 bg-amber-400/5' : 'border-zinc-800 bg-zinc-900'">
          <p class="text-xs uppercase tracking-wide" :class="falta.length ? 'text-amber-400' : 'text-zinc-500'">Falta pedir</p>
          <p class="mt-1 text-xl font-semibold" :class="falta.length ? 'text-amber-300' : 'text-white'">{{ falta.length }}</p>
        </div>
        <div class="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p class="text-xs uppercase tracking-wide text-zinc-500">Já pedidos</p>
          <p class="mt-1 text-xl font-semibold text-emerald-400">{{ comQuantidade.length - falta.length }}</p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl v-model="filtro" :options="filtroOptions" />
        <p class="text-xs text-zinc-500">
          Começado em {{ formatarDataCurta(pedido.criadoEm) }} ·
          <span :class="pendentes ? 'text-amber-400' : ''">{{ pendentes ? 'salvando...' : 'tudo salvo' }}</span>
        </p>
      </div>

      <p class="text-xs text-zinc-500">
        Digite em <span class="text-zinc-300">Tem hoje</span> quanto há no estoque (nos produtos em fardo/caixa:
        quantos fechados e quantas soltas). O sistema sugere <span class="text-zinc-300">Pedir</span> em embalagens
        fechadas, arredondando para cima. Você pode mudar o valor. Depois de mandar para o fornecedor, marque
        <span class="text-zinc-300">Pedido</span>.
      </p>

      <p v-if="!grupos.length" class="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-400">
        {{ filtro === 'falta' ? 'Tudo já foi pedido.' : 'Nenhum item aqui.' }}
      </p>

      <!-- Fornecedores -->
      <section
        v-for="g in grupos"
        :key="g.fornecedor ?? ''"
        class="overflow-hidden rounded-xl border bg-zinc-900"
        :class="g.tudoPedido ? 'border-emerald-500/40' : 'border-zinc-800'"
      >
        <header class="flex flex-col gap-2 border-b border-zinc-800 bg-zinc-950/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
              <CheckCircleIcon v-if="g.tudoPedido" class="h-4 w-4 shrink-0 text-emerald-400" />
              {{ g.fornecedor ?? 'Sem fornecedor' }}
            </p>
            <p class="text-xs text-zinc-500">
              {{ g.pedir.length }} {{ g.pedir.length === 1 ? 'item' : 'itens' }} a pedir
              <template v-if="g.total > 0"> · {{ formatMoeda(g.total) }}</template>
            </p>
          </div>
          <div v-if="g.pedir.length" class="flex flex-wrap gap-1.5">
            <a
              :href="linkWhatsapp(textoFornecedor(g.fornecedor, g.pedir))"
              target="_blank"
              rel="noopener"
              class="rounded-md border border-emerald-500/40 px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-400/10"
            >
              WhatsApp
            </a>
            <button
              type="button"
              class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800"
              @click="copiar(textoFornecedor(g.fornecedor, g.pedir))"
            >
              <DocumentDuplicateIcon class="h-3.5 w-3.5" /> Copiar
            </button>
            <button
              type="button"
              class="cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold"
              :class="g.tudoPedido ? 'border-zinc-700 text-zinc-400 hover:bg-zinc-800' : 'border-amber-400/50 text-amber-400 hover:bg-amber-400/10'"
              @click="marcarFornecedor(g.pedir, !g.tudoPedido)"
            >
              {{ g.tudoPedido ? 'Desmarcar' : 'Marcar tudo como pedido' }}
            </button>
          </div>
        </header>

        <div class="hidden grid-cols-[minmax(0,1fr)_13rem_7.5rem_6.5rem_5rem] gap-3 px-4 pt-3 text-[11px] uppercase tracking-wide text-zinc-500 lg:grid">
          <span>Produto</span>
          <span class="text-right">Tem hoje</span>
          <span class="text-right">Pedir</span>
          <span class="text-right">Estimado</span>
          <span class="text-center">Pedido</span>
        </div>

        <ul class="divide-y divide-zinc-800/70">
          <li
            v-for="item in g.itens"
            :key="item.id"
            class="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_13rem_7.5rem_6.5rem_5rem]"
            :class="item.pedidoFeito ? 'bg-emerald-500/5' : ''"
          >
            <div class="min-w-0">
              <p class="truncate text-sm font-medium" :class="item.pedidoFeito ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-zinc-100'">
                {{ item.nome }}
              </p>
              <p class="text-xs text-zinc-500">
                {{ descreverEmbalagem(item) }} · ideal {{ unidadesComEmbalagens(item.quantidadeIdeal, item) }}
                <template v-if="item.preco !== null"> · {{ formatMoeda(item.preco) }}/{{ nomeEmbalagem(item) }}</template>
              </p>
              <p v-if="item.unidadesPorEmbalagem > 1 && item.estoqueAtual !== null" class="text-xs text-zinc-500">
                Tem {{ quantidadeParaTexto(item.estoqueAtual) }} {{ unidadeComPlural(item.unidadeAvulsa, item.estoqueAtual) }}
                <template v-if="item.quantidade > 0">
                  · pedindo {{ quantidadeParaTexto(item.quantidade * item.unidadesPorEmbalagem) }}
                  {{ unidadeComPlural(item.unidadeAvulsa, item.quantidade * item.unidadesPorEmbalagem) }}
                </template>
              </p>
              <p v-if="consumoDe(item.produtoId)" class="text-xs text-amber-300/90">
                Saiu no bar: ~{{ unidadesComEmbalagens(consumoDe(item.produtoId)!.mediaSemanal, item) }} por semana
              </p>
            </div>

            <!-- Celular: botao "Pedido" ao lado do nome -->
            <button
              type="button"
              class="cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-30 lg:hidden"
              :class="item.pedidoFeito ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 text-zinc-400'"
              :disabled="item.quantidade <= 0"
              @click="alternarPedido(item)"
            >
              {{ item.pedidoFeito ? '✓ Pedido' : 'Pedido?' }}
            </button>

            <div class="col-span-2 grid grid-cols-2 items-end gap-2 lg:contents">
              <!-- "Tem hoje": o nome (fardos/unidades) fica DENTRO do campo, para todas as linhas terem a mesma altura -->
              <div class="col-span-2 lg:col-span-1">
                <span class="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500 lg:hidden">Tem hoje</span>
                <div v-if="item.unidadesPorEmbalagem > 1" class="grid grid-cols-2 gap-1.5">
                  <label class="relative block">
                    <span :class="rotuloCampo">{{ unidadeComPlural(nomeEmbalagem(item), 2) }}</span>
                    <input
                      :value="textoFechados[item.id]"
                      inputmode="decimal"
                      placeholder="—"
                      :aria-label="`${unidadeComPlural(nomeEmbalagem(item), 2)} fechados de ${item.nome}`"
                      :class="[campo, 'pl-[4.5rem]', invalidos[`f-${item.id}`] ? 'border-red-500/60' : 'border-zinc-700']"
                      @input="aoDigitarEstoque(item, ($event.target as HTMLInputElement).value, 'fechados')"
                    />
                  </label>
                  <label class="relative block">
                    <span :class="rotuloCampo">{{ unidadeComPlural(item.unidadeAvulsa, 2) }}</span>
                    <input
                      :value="textoEstoque[item.id]"
                      inputmode="decimal"
                      placeholder="—"
                      :aria-label="`${unidadeComPlural(item.unidadeAvulsa, 2)} soltas de ${item.nome}`"
                      :class="[campo, 'pl-[4.5rem]', invalidos[`e-${item.id}`] ? 'border-red-500/60' : 'border-zinc-700']"
                      @input="aoDigitarEstoque(item, ($event.target as HTMLInputElement).value, 'soltos')"
                    />
                  </label>
                </div>
                <label v-else class="relative block">
                  <span :class="rotuloCampo">{{ unidadeComPlural(item.unidade, 2) }}</span>
                  <input
                    :value="textoEstoque[item.id]"
                    inputmode="decimal"
                    placeholder="—"
                    :aria-label="`Quanto tem hoje de ${item.nome}`"
                    :class="[campo, 'pl-[4.5rem]', invalidos[`e-${item.id}`] ? 'border-red-500/60' : 'border-zinc-700']"
                    @input="aoDigitarEstoque(item, ($event.target as HTMLInputElement).value)"
                  />
                </label>
              </div>
              <!-- "Pedir" e contado na embalagem de compra do produto (fardo, caixa... ou unidade) -->
              <label class="block">
                <span class="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500 lg:hidden">Pedir</span>
                <span class="relative block">
                  <span :class="rotuloCampo">{{ unidadeComPlural(nomeEmbalagem(item), 2) }}</span>
                  <input
                    :value="textoQuantidade[item.id]"
                    inputmode="decimal"
                    placeholder="0"
                    :aria-label="`Quanto pedir de ${item.nome}`"
                    :class="[
                      campo,
                      'pl-[4.5rem] font-semibold',
                      invalidos[`q-${item.id}`] ? 'border-red-500/60' : item.quantidade > 0 ? 'border-amber-400/50' : 'border-zinc-700'
                    ]"
                    @input="aoDigitarQuantidade(item, ($event.target as HTMLInputElement).value)"
                  />
                </span>
              </label>
              <p class="text-right text-sm lg:self-center">
                <span class="mb-1 block text-[10px] uppercase tracking-wide text-zinc-500 lg:hidden">Estimado</span>
                <span class="block py-[9px] lg:py-0" :class="valorEstimado(item) !== null ? 'text-zinc-200' : 'text-zinc-600'">
                  {{ valorEstimado(item) !== null ? formatMoeda(valorEstimado(item)!) : '—' }}
                </span>
              </p>
            </div>

            <div class="hidden justify-center lg:flex">
              <input
                type="checkbox"
                class="h-5 w-5 cursor-pointer accent-emerald-500 disabled:cursor-not-allowed disabled:opacity-30"
                :checked="item.pedidoFeito"
                :disabled="item.quantidade <= 0"
                :aria-label="`Marcar ${item.nome} como pedido`"
                @change="alternarPedido(item)"
              />
            </div>
          </li>
        </ul>
      </section>

      <!-- Acoes do pedido -->
      <div class="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap gap-2">
          <AppButton variant="outline" size="sm" :disabled="!comQuantidade.length" @click="copiar(mensagemPedido(comQuantidade, { data: dataPedido }))">
            <DocumentDuplicateIcon class="h-4 w-4" /> Copiar pedido completo
          </AppButton>
          <AppButton variant="ghost" size="sm" @click="confirmarDescartar = true">Descartar</AppButton>
        </div>
        <AppButton variant="primary" :disabled="!comQuantidade.length" @click="confirmarFinalizar = true">
          Finalizar pedido da semana
        </AppButton>
      </div>
    </template>

    <ConfirmDialog
      :open="confirmarFinalizar"
      title="Finalizar o pedido da semana?"
      :description="descricaoFinalizar"
      confirm-label="Finalizar"
      :loading="finalizando"
      @confirm="finalizar"
      @cancel="confirmarFinalizar = false"
    />
    <ConfirmDialog
      :open="confirmarDescartar"
      title="Descartar este pedido?"
      description="Tudo o que foi digitado neste pedido será apagado. Os produtos cadastrados continuam."
      confirm-label="Descartar"
      tone="danger"
      :loading="finalizando"
      @confirm="descartar"
      @cancel="confirmarDescartar = false"
    />
  </div>
</template>
