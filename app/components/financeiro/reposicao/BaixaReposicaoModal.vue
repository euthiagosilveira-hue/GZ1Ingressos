<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue3-toastify'

import AppButton from '~/components/AppButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import { listarItensLancamento } from '~/services/admin/caixa'
import {
  darBaixaReposicaoCompra,
  listarNomesCompraReposicao,
  listarProdutosReposicao,
  obterPedidoAbertoReposicao
} from '~/services/admin/reposicao'
import type { ItemLancamento } from '~/types/caixa'
import type { PedidoReposicao, ProdutoReposicao } from '~/types/reposicao'
import type { SelectOption } from '~/types/ui'
import { formatMoeda } from '~/utils/format'
import {
  type OrigemCasamento,
  casarItemCompra,
  lerQuantidade,
  mensagemErroBaixaReposicao,
  nomeEmbalagem,
  quantidadeParaTexto,
  unidadeComPlural
} from '~/utils/reposicao'

const props = defineProps<{
  open: boolean
  lancamentoId: string | null
  descricao?: string
  /** Itens da nota; null = buscar os itens salvos da saida. */
  itens?: ItemLancamento[] | null
  /**
   * Aberto sozinho logo depois de lancar a saida: se nao tiver pedido aberto
   * ou nenhum item parecer da reposicao, fecha sem mostrar nada.
   */
  automatico?: boolean
}>()

const emit = defineEmits<{
  close: []
  concluido: []
}>()

interface Linha {
  nome: string
  quantidadeNota: number
  valorTotal: number
  produtoId: string
  origem: OrigemCasamento
  quantidade: string
}

const carregando = ref(false)
const salvando = ref(false)
const erro = ref('')
const pedido = ref<PedidoReposicao | null>(null)
const produtos = ref<ProdutoReposicao[]>([])
const linhas = ref<Linha[]>([])
const visivel = ref(false)

const produtoOptions = computed<SelectOption[]>(() => [
  { value: '', label: 'Não é da reposição' },
  ...[...produtos.value]
    .filter((p) => p.ativo)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((p) => ({ value: p.id, label: p.nome }))
])

function produto(id: string): ProdutoReposicao | null {
  return produtos.value.find((p) => p.id === id) ?? null
}

function itemDoPedido(produtoId: string) {
  return pedido.value?.itens.find((i) => i.produtoId === produtoId) ?? null
}

function textoEmbalagens(p: ProdutoReposicao | { unidade: string; unidadesPorEmbalagem: number }, q: number): string {
  return `${quantidadeParaTexto(q)} ${unidadeComPlural(nomeEmbalagem(p), q)}`
}

const marcadas = computed(() => linhas.value.filter((l) => l.produtoId))
const quantidadesValidas = computed(() =>
  marcadas.value.every((l) => {
    const q = lerQuantidade(l.quantidade)
    return q !== null && Number.isFinite(q) && q > 0
  })
)

async function carregar() {
  carregando.value = true
  erro.value = ''
  linhas.value = []
  try {
    const [lista, nomes, aberto, itens] = await Promise.all([
      listarProdutosReposicao(),
      listarNomesCompraReposicao(),
      obterPedidoAbertoReposicao(),
      props.itens ? Promise.resolve(props.itens) : listarItensLancamento(props.lancamentoId!)
    ])
    produtos.value = lista
    pedido.value = aberto
    linhas.value = itens.map((i) => {
      const c = casarItemCompra(i.descricao, nomes, lista)
      return {
        nome: i.descricao,
        quantidadeNota: i.quantidade,
        valorTotal: i.valorTotal,
        produtoId: c.produtoId ?? '',
        origem: c.origem,
        quantidade: quantidadeParaTexto(i.quantidade)
      }
    })
    if (props.automatico && (!aberto || !linhas.value.some((l) => l.produtoId))) {
      emit('close')
      return
    }
    visivel.value = true
  } catch (e) {
    if (props.automatico) {
      emit('close')
      return
    }
    erro.value = mensagemErroBaixaReposicao(e)
    visivel.value = true
  } finally {
    carregando.value = false
  }
}

watch(
  () => [props.open, props.lancamentoId] as const,
  ([aberto, id]) => {
    visivel.value = false
    if (aberto && id) {
      if (!props.automatico) visivel.value = true
      void carregar()
    }
  },
  { immediate: true }
)

function escolher(l: Linha, id: string) {
  l.produtoId = id
  l.origem = id ? 'lembrado' : 'ignorado'
}

async function confirmar() {
  if (!props.lancamentoId || !pedido.value) return
  if (!quantidadesValidas.value) {
    erro.value = 'Confira as quantidades: precisam ser maiores que zero.'
    return
  }
  salvando.value = true
  erro.value = ''
  try {
    const n = await darBaixaReposicaoCompra(
      props.lancamentoId,
      linhas.value.map((l) => ({
        nome: l.nome,
        produtoId: l.produtoId || null,
        quantidade: l.produtoId ? (lerQuantidade(l.quantidade) as number) : 0,
        valorTotal: l.valorTotal > 0 ? l.valorTotal : null,
        ignorar: !l.produtoId && l.origem === 'ignorado'
      }))
    )
    toast.success(
      n === 0
        ? 'Nada marcado na reposição.'
        : `Baixa feita: ${n} ${n === 1 ? 'produto marcado' : 'produtos marcados'} como comprado no pedido da semana.`
    )
    emit('concluido')
  } catch (e) {
    erro.value = mensagemErroBaixaReposicao(e)
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="props.open && visivel"
    size="lg"
    title="Dar baixa na reposição"
    subtitle="Confira quais itens da nota são do pedido da semana. Eles ficam marcados como comprados."
    @close="emit('close')"
  >
    <div class="space-y-4">
      <p v-if="props.descricao" class="text-sm text-zinc-400">{{ props.descricao }}</p>

      <p v-if="carregando" class="text-sm text-zinc-500">Carregando...</p>

      <p v-else-if="erro && !pedido" class="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
        {{ erro }}
      </p>

      <p
        v-else-if="!pedido"
        class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
      >
        Não tem pedido da semana aberto. Abra o pedido em Financeiro &gt; Reposição e volte aqui (pelo botão
        "Reposição" desta saída na lista de lançamentos).
      </p>

      <p v-else-if="linhas.length === 0" class="text-sm text-zinc-400">
        Esta saída não tem itens. Abra a saída, adicione os itens (ou leia o comprovante com a IA) e tente de novo.
      </p>

      <ul v-else class="space-y-3">
        <li
          v-for="(l, i) in linhas"
          :key="i"
          class="rounded-xl border p-3"
          :class="l.produtoId ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-950/40'"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-medium text-zinc-100">{{ l.nome }}</p>
              <p class="text-xs text-zinc-500">
                Na nota: {{ quantidadeParaTexto(l.quantidadeNota) }} · {{ formatMoeda(l.valorTotal) }}
              </p>
            </div>
            <span
              v-if="l.produtoId && l.origem === 'parecido'"
              class="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300"
            >
              Confira
            </span>
          </div>

          <div class="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <BaseSelect
              :model-value="l.produtoId"
              :options="produtoOptions"
              @update:model-value="escolher(l, $event)"
            />
            <label v-if="l.produtoId" class="relative block">
              <input
                v-model="l.quantidade"
                inputmode="decimal"
                class="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 pl-3 pr-16 text-right text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                aria-label="Quantidade comprada"
              />
              <span class="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-zinc-500">
                {{ unidadeComPlural(nomeEmbalagem(produto(l.produtoId)!), 2) }}
              </span>
            </label>
          </div>

          <p v-if="l.produtoId" class="mt-1.5 text-xs">
            <template v-if="itemDoPedido(l.produtoId)?.quantidade">
              <span class="text-zinc-400">
                No pedido: {{ textoEmbalagens(itemDoPedido(l.produtoId)!, itemDoPedido(l.produtoId)!.quantidade) }}
              </span>
              <span
                v-if="(lerQuantidade(l.quantidade) ?? 0) !== itemDoPedido(l.produtoId)!.quantidade"
                class="text-amber-300"
              >
                · comprado diferente do pedido
              </span>
            </template>
            <span v-else class="text-zinc-500">Não estava no pedido desta semana: entra como comprado.</span>
          </p>
        </li>
      </ul>

      <p v-if="erro && pedido" class="text-sm text-red-400">{{ erro }}</p>
    </div>

    <template #footer>
      <div class="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <AppButton variant="ghost" :disabled="salvando" @click="emit('close')">Agora não</AppButton>
        <AppButton
          v-if="pedido && linhas.length"
          :disabled="salvando || carregando || marcadas.length === 0"
          @click="confirmar"
        >
          {{ salvando ? 'Dando baixa...' : `Dar baixa (${marcadas.length})` }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
