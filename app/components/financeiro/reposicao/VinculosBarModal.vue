<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { toast } from 'vue3-toastify'

import AppButton from '~/components/AppButton.vue'
import BaseModal from '~/components/BaseModal.vue'
import { listarProdutosReposicao, listarVinculosBar, salvarVinculoBar } from '~/services/admin/reposicao'
import type { ProdutoReposicao, VinculoBar } from '~/types/reposicao'
import { formatarQuantidade } from '~/utils/caixa'
import {
  lerQuantidade,
  mensagemErroVendasBar,
  quantidadeParaTexto,
  sugerirProdutoReposicao,
  sugerirVendasPorUnidade
} from '~/utils/reposicao'

// Liga cada produto do bar a um produto da Reposicao e diz quantas vendas
// gastam 1 unidade solta (1 lata = 1; dose: 1 garrafa = 16). A conversao para
// fardo/caixa vem da embalagem cadastrada no produto.

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; salvou: [] }>()

type Linha = {
  vinculo: VinculoBar
  produtoId: string
  fator: string
  sugerido: boolean
  erro: string
}

const linhas = ref<Linha[]>([])
const produtos = ref<ProdutoReposicao[]>([])
const carregando = ref(false)
const erroCarga = ref('')
const salvando = ref(false)

// Doses, combos e porcoes gastam ingredientes (receita): nao sugere ligacao.
const GRUPO_PREPARADO = /dose|combo|por[cç]/i

async function carregar() {
  carregando.value = true
  erroCarga.value = ''
  try {
    const [vinculos, lista] = await Promise.all([listarVinculosBar(), listarProdutosReposicao()])
    produtos.value = lista.filter((p) => p.ativo)
    linhas.value = vinculos.map((v) => {
      if (v.produtoId) {
        return { vinculo: v, produtoId: v.produtoId, fator: quantidadeParaTexto(v.vendasPorUnidade), sugerido: false, erro: '' }
      }
      const sugestao = GRUPO_PREPARADO.test(v.grupo ?? '') ? null : sugerirProdutoReposicao(v.descricao, produtos.value)
      return {
        vinculo: v,
        produtoId: sugestao?.id ?? '',
        fator: quantidadeParaTexto(sugestao ? sugerirVendasPorUnidade(sugestao) : 1),
        sugerido: !!sugestao,
        erro: ''
      }
    })
  } catch (e) {
    erroCarga.value = mensagemErroVendasBar(e, 'Não foi possível carregar os produtos.')
  } finally {
    carregando.value = false
  }
}

watch(
  () => props.open,
  (aberto) => {
    if (aberto) void carregar()
  }
)

const porId = computed(() => new Map(produtos.value.map((p) => [p.id, p])))

function aoTrocarProduto(l: Linha) {
  l.sugerido = false
  const p = porId.value.get(l.produtoId)
  l.fator = quantidadeParaTexto(p ? sugerirVendasPorUnidade(p) : 1)
}

function mudou(l: Linha): boolean {
  const original = l.vinculo.produtoId ?? ''
  if (l.produtoId !== original) return true
  if (!l.produtoId) return false
  return lerQuantidade(l.fator) !== l.vinculo.vendasPorUnidade
}

const alteradas = computed(() => linhas.value.filter(mudou))
const sugeridas = computed(() => linhas.value.filter((l) => l.sugerido && l.produtoId).length)

async function salvar() {
  let invalida = false
  for (const l of alteradas.value) {
    const n = lerQuantidade(l.fator)
    l.erro = l.produtoId && (n === null || Number.isNaN(n) || n <= 0) ? 'Número inválido' : ''
    if (l.erro) invalida = true
  }
  if (invalida) return

  salvando.value = true
  let ok = 0
  try {
    for (const l of alteradas.value) {
      await salvarVinculoBar({
        codigo: l.vinculo.codigo,
        produtoId: l.produtoId || null,
        vendasPorUnidade: l.produtoId ? lerQuantidade(l.fator)! : 1
      })
      ok++
    }
    toast.success(ok === 1 ? '1 ligação salva.' : `${ok} ligações salvas.`)
    emit('salvou')
    emit('close')
  } catch (e) {
    toast.error(mensagemErroVendasBar(e, 'Não foi possível salvar todas as ligações.'))
    if (ok) emit('salvou')
  } finally {
    salvando.value = false
  }
}
</script>

<template>
  <BaseModal
    :open="props.open"
    title="Ligar produtos do bar"
    subtitle="Escolha o produto da Reposição que cada venda do bar gasta. Deixe 'Não controlar' para doses, porções e o que não entra no estoque."
    size="xl"
    @close="emit('close')"
  >
    <div v-if="carregando" class="flex items-center gap-3 p-4 text-sm text-zinc-400">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" aria-hidden="true" />
      Carregando...
    </div>
    <p v-else-if="erroCarga" class="text-sm text-red-400">{{ erroCarga }}</p>
    <p v-else-if="!linhas.length" class="text-sm text-zinc-400">Importe um relatório do bar primeiro.</p>
    <p v-else-if="!produtos.length" class="text-sm text-zinc-400">
      Cadastre os produtos na aba "Produtos" da Reposição primeiro.
    </p>
    <template v-else>
      <p v-if="sugeridas" class="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-amber-200">
        Já deixei {{ sugeridas }} {{ sugeridas === 1 ? 'sugestão marcada' : 'sugestões marcadas' }} pelo nome. Confira
        antes de salvar, principalmente o produto escolhido.
      </p>
      <ul class="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        <li
          v-for="l in linhas"
          :key="l.vinculo.codigo"
          class="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_9rem] sm:items-center"
        >
          <div class="min-w-0">
            <p class="truncate text-sm font-medium text-zinc-100">
              {{ l.vinculo.descricao }}
              <span v-if="l.sugerido && l.produtoId" class="ml-1 rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] uppercase text-amber-300">sugestão</span>
            </p>
            <p class="text-xs text-zinc-500">
              {{ l.vinculo.grupo ?? 'Sem grupo' }} · {{ formatarQuantidade(l.vinculo.quantidadeTotal) }} vendidos
            </p>
          </div>
          <select
            v-model="l.produtoId"
            class="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
            :aria-label="`Produto da reposição para ${l.vinculo.descricao}`"
            @change="aoTrocarProduto(l)"
          >
            <option value="">Não controlar</option>
            <option v-for="p in produtos" :key="p.id" :value="p.id">{{ p.nome }}</option>
          </select>
          <div v-if="l.produtoId">
            <div class="flex items-center gap-2">
              <input
                v-model="l.fator"
                inputmode="decimal"
                class="w-16 rounded-lg border bg-zinc-950 px-2 py-2 text-right text-sm text-zinc-100 focus:border-amber-400 focus:outline-none"
                :class="l.erro ? 'border-red-500/60' : 'border-zinc-700'"
                :aria-label="`Vendas por unidade de ${l.vinculo.descricao}`"
                @input="l.sugerido = false"
              />
              <span class="text-xs leading-tight text-zinc-400">
                vendas = 1 {{ porId.get(l.produtoId)?.unidadesPorEmbalagem! > 1 ? porId.get(l.produtoId)?.unidadeAvulsa : porId.get(l.produtoId)?.unidade ?? 'unidade' }}
              </span>
            </div>
            <p v-if="l.erro" class="mt-1 text-xs text-red-400">{{ l.erro }}</p>
          </div>
          <span v-else class="hidden sm:block" />
        </li>
      </ul>
      <p class="mt-3 text-xs text-zinc-500">
        Quase sempre é 1 (cada venda no bar = 1 lata ou 1 garrafa). O fardo/caixa é calculado pela embalagem do
        produto. Só mude para dose: ex.: 1 garrafa de whisky = 16 doses, coloque 16.
      </p>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <AppButton variant="ghost" :disabled="salvando" @click="emit('close')">Cancelar</AppButton>
        <AppButton variant="primary" :disabled="salvando || carregando || !alteradas.length" @click="salvar">
          {{ salvando ? 'Salvando...' : alteradas.length ? `Salvar ${alteradas.length}` : 'Nada para salvar' }}
        </AppButton>
      </div>
    </template>
  </BaseModal>
</template>
