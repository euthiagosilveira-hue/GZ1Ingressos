<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { toast } from 'vue3-toastify'
import {
  ArrowDownOnSquareStackIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon
} from '@heroicons/vue/24/outline'

import AppButton from '~/components/AppButton.vue'
import BaseInput from '~/components/BaseInput.vue'
import BaseModal from '~/components/BaseModal.vue'
import ConfirmDialog from '~/components/ConfirmDialog.vue'
import BaseSelect from '~/components/BaseSelect.vue'
import FormField from '~/components/FormField.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import { listarHistoricoItens } from '~/services/admin/caixa'
import {
  excluirProdutoReposicao,
  importarProdutosReposicao,
  listarNomesCompraReposicao,
  listarProdutosReposicao,
  obterConsumoBar,
  salvarProdutoReposicao,
  vincularNomeCompraReposicao
} from '~/services/admin/reposicao'
import type { ConsumoBar, ProdutoReposicao } from '~/types/reposicao'
import type { SelectOption } from '~/types/ui'
import { lerValorReais } from '~/utils/caixa'
import { formatMoeda } from '~/utils/format'
import {
  agruparPorFornecedor,
  descreverEmbalagem,
  detectarEmbalagemPeloNome,
  idealPeloConsumo,
  lerQuantidade,
  mensagemErroReposicao,
  mesmoNome,
  nomeEmbalagem,
  quantidadeParaTexto,
  unidadeComPlural,
  unidadesComEmbalagens
} from '~/utils/reposicao'

// Cadastro dos produtos que a galeria pede toda semana.

const emit = defineEmits<{ alterou: [] }>()

const produtos = ref<ProdutoReposicao[]>([])
const carregando = ref(true)
const erro = ref('')
const busca = ref('')

// Quanto saiu no bar por semana (relatorios do bar ligados aos produtos).
const consumo = ref<ConsumoBar | null>(null)

async function carregarConsumo() {
  try {
    consumo.value = await obterConsumoBar(4)
  } catch {
    consumo.value = null // SQL das vendas do bar ainda nao rodado: so nao mostra
  }
}

function consumoDe(id: string | null) {
  return id ? (consumo.value?.porProduto[id] ?? null) : null
}

async function carregar() {
  carregando.value = true
  erro.value = ''
  void carregarConsumo()
  try {
    produtos.value = await listarProdutosReposicao()
  } catch (e) {
    erro.value = mensagemErroReposicao(e, 'Não foi possível carregar os produtos.')
  } finally {
    carregando.value = false
  }
}

onMounted(carregar)

const filtrados = computed(() => {
  const b = busca.value.trim().toLowerCase()
  if (!b) return produtos.value
  return produtos.value.filter(
    (p) => p.nome.toLowerCase().includes(b) || (p.fornecedor ?? '').toLowerCase().includes(b)
  )
})

// Agrupa por fornecedor reaproveitando o agrupamento do pedido.
const grupos = computed(() => {
  const porId = new Map(filtrados.value.map((p) => [p.id, p]))
  return agruparPorFornecedor(
    filtrados.value.map((p) => ({
      id: p.id,
      produtoId: p.id,
      nome: p.nome,
      unidade: p.unidade,
      unidadesPorEmbalagem: p.unidadesPorEmbalagem,
      unidadeAvulsa: p.unidadeAvulsa,
      fornecedor: p.fornecedor,
      preco: p.ultimoPreco,
      quantidadeIdeal: p.quantidadeIdeal,
      estoqueAtual: null,
      estoqueFechados: null,
      estoqueSoltos: null,
      quantidade: 0,
      pedidoFeito: false,
      pedidoFeitoEm: null,
      quantidadeComprada: null
    }))
  ).map((g) => ({ fornecedor: g.fornecedor, produtos: g.itens.map((i) => porId.get(i.id)!) }))
})

const fornecedores = computed(() =>
  [...new Set(produtos.value.map((p) => p.fornecedor).filter((f): f is string => !!f))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  )
)
// Comprado por unidade (1 por vez) ou em embalagem com varias unidades dentro.
const EMBALAGENS = ['fardo', 'caixa', 'pacote', 'engradado']
const UNIDADES_AVULSAS = ['unidade', 'saco', 'garrafa', 'kg', 'litro', 'galão', 'pacote']
const AVULSAS = ['unidade', 'lata', 'garrafa', 'long neck', 'sachê', 'pacote']
const tipoCompraOptions: SelectOption[] = [
  { value: 'UNIDADE', label: 'Por unidade' },
  { value: 'EMBALAGEM', label: 'Em embalagem (fardo, caixa...)' }
]
const embalagemOptions = computed<SelectOption[]>(() => {
  const lista = [...EMBALAGENS]
  const atual = form.unidade.trim()
  if (atual && !/^unidades?$/i.test(atual) && !lista.includes(atual)) lista.push(atual)
  return lista.map((u) => ({ value: u, label: u.charAt(0).toUpperCase() + u.slice(1) }))
})

// --- Produto ---------------------------------------------------------------
const modal = ref(false)
const form = reactive({
  id: null as string | null,
  nome: '',
  tipoCompra: 'UNIDADE' as 'UNIDADE' | 'EMBALAGEM',
  unidade: 'unidade',
  porEmbalagem: '1',
  avulsa: 'unidade',
  fornecedor: '',
  preco: '',
  ideal: '',
  ativo: true
})
const erros = reactive({ nome: '', preco: '', ideal: '', porEmbalagem: '' })

// Numero de unidades por embalagem digitado (1 se vazio/invalido).
const porEmbalagemForm = computed(() => {
  if (form.tipoCompra === 'UNIDADE') return 1
  const n = lerQuantidade(form.porEmbalagem)
  return n !== null && !Number.isNaN(n) && n > 0 ? n : 1
})
const formEmbalagem = computed(() => ({
  unidade: form.unidade.trim() || 'unidade',
  unidadesPorEmbalagem: porEmbalagemForm.value,
  unidadeAvulsa: form.avulsa.trim() || 'unidade'
}))
// O nome diz "FD/12", "C/144"...: oferece preencher a embalagem.
const embalagemDoNome = computed(() => {
  const d = detectarEmbalagemPeloNome(form.nome)
  if (!d) return null
  if (form.tipoCompra === 'EMBALAGEM' && d.unidadesPorEmbalagem === porEmbalagemForm.value && d.unidade === form.unidade.trim()) return null
  return d
})
const idealFormEquivale = computed(() => {
  const n = lerQuantidade(form.ideal)
  if (n === null || Number.isNaN(n) || !n || porEmbalagemForm.value <= 1) return ''
  return unidadesComEmbalagens(n, formEmbalagem.value)
})

// Consumo do bar ja vem em unidades soltas (latas, garrafas).
function consumoUnidades(id: string | null, _por?: number): number | null {
  const c = consumoDe(id)
  return c ? Math.round(c.mediaSemanal * 10) / 10 : null
}
const salvando = ref(false)

function aoTrocarTipoCompra(tipo: string) {
  if (tipo === 'EMBALAGEM') {
    if (!EMBALAGENS.includes(form.unidade.trim()) && !embalagemOptions.value.some((o) => o.value === form.unidade.trim())) {
      form.unidade = 'fardo'
    }
    if ((lerQuantidade(form.porEmbalagem) ?? 1) <= 1) form.porEmbalagem = ''
  } else if (!form.unidade.trim() || EMBALAGENS.includes(form.unidade.trim())) {
    form.unidade = 'unidade'
  }
}

function usarEmbalagemDoNome() {
  if (!embalagemDoNome.value) return
  form.tipoCompra = 'EMBALAGEM'
  form.unidade = embalagemDoNome.value.unidade
  form.porEmbalagem = String(embalagemDoNome.value.unidadesPorEmbalagem)
}

function abrir(p: ProdutoReposicao | null) {
  form.id = p?.id ?? null
  form.nome = p?.nome ?? ''
  form.tipoCompra = (p?.unidadesPorEmbalagem ?? 1) > 1 ? 'EMBALAGEM' : 'UNIDADE'
  form.unidade = p?.unidade ?? 'unidade'
  // Antes dava para ter "unidade" com 12 dentro: vira fardo para conferir.
  if (form.tipoCompra === 'EMBALAGEM' && /^unidades?$/i.test(form.unidade.trim())) form.unidade = 'fardo'
  form.porEmbalagem = quantidadeParaTexto(p?.unidadesPorEmbalagem ?? 1)
  form.avulsa = p?.unidadeAvulsa ?? 'unidade'
  form.fornecedor = p?.fornecedor ?? ''
  form.preco = p?.ultimoPreco !== null && p?.ultimoPreco !== undefined ? p.ultimoPreco.toFixed(2).replace('.', ',') : ''
  form.ideal = p ? quantidadeParaTexto(p.quantidadeIdeal) : ''
  form.ativo = p ? p.ativo : true
  erros.nome = erros.preco = erros.ideal = erros.porEmbalagem = ''
  modal.value = true
}

async function salvar() {
  erros.nome = form.nome.trim() ? '' : 'Informe o nome.'
  const preco = form.preco.trim() ? lerValorReais(form.preco) : null
  erros.preco = form.preco.trim() && (preco === null || preco < 0) ? 'Preço inválido.' : ''
  const ideal = lerQuantidade(form.ideal)
  erros.ideal = ideal !== null && Number.isNaN(ideal) ? 'Quantidade inválida.' : ''
  const por = form.tipoCompra === 'UNIDADE' ? 1 : lerQuantidade(form.porEmbalagem)
  erros.porEmbalagem =
    form.tipoCompra === 'EMBALAGEM' && (por === null || Number.isNaN(por) || por <= 1)
      ? 'Quantas unidades vêm na embalagem? (2 ou mais)'
      : ''
  if (erros.nome || erros.preco || erros.ideal || erros.porEmbalagem) return

  salvando.value = true
  try {
    await salvarProdutoReposicao({
      id: form.id,
      nome: form.nome,
      unidade: form.tipoCompra === 'EMBALAGEM' ? form.unidade.trim() || 'fardo' : form.unidade.trim() || 'unidade',
      fornecedor: form.fornecedor,
      ultimoPreco: preco,
      quantidadeIdeal: ideal ?? 0,
      ativo: form.ativo,
      unidadesPorEmbalagem: por ?? 1,
      unidadeAvulsa: form.avulsa
    })
    toast.success('Produto salvo.')
    modal.value = false
    await carregar()
    emit('alterou')
  } catch (e) {
    toast.error(mensagemErroReposicao(e))
  } finally {
    salvando.value = false
  }
}

// --- Excluir ---------------------------------------------------------------
const excluindo = ref<ProdutoReposicao | null>(null)
const excluindoCarregando = ref(false)

async function confirmarExclusao() {
  if (!excluindo.value) return
  excluindoCarregando.value = true
  try {
    await excluirProdutoReposicao(excluindo.value.id)
    toast.success('Produto excluído.')
    excluindo.value = null
    modal.value = false
    await carregar()
    emit('alterou')
  } catch (e) {
    toast.error(mensagemErroReposicao(e, 'Não foi possível excluir.'))
  } finally {
    excluindoCarregando.value = false
  }
}

// --- Importar de "Itens comprados" ---------------------------------------
const modalImportar = ref(false)
const carregandoImportar = ref(false)
const importando = ref(false)
// O que fazer com cada nome da nota: 'novo' cadastra, 'depois' deixa para
// outra vez, 'ignorar' nunca mais mostra, ou o id do produto ja cadastrado.
const sugestoes = ref<{ nome: string; ultimoPreco: number | null; acao: string }[]>([])

const acaoImportarOptions = computed<SelectOption[]>(() => [
  { value: 'novo', label: 'Cadastrar como produto novo' },
  { value: 'depois', label: 'Deixar para depois' },
  { value: 'ignorar', label: 'Não é de reposição (não mostrar mais)' },
  ...[...produtos.value]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((p) => ({ value: p.id, label: `É o mesmo que: ${p.nome}` }))
])

async function abrirImportar() {
  modalImportar.value = true
  carregandoImportar.value = true
  sugestoes.value = []
  try {
    const [hist, nomes] = await Promise.all([
      listarHistoricoItens({ de: null, ate: null, busca: '' }),
      listarNomesCompraReposicao()
    ])
    const conhecidos = [...produtos.value.map((p) => p.nome), ...nomes.map((n) => n.nome)]
    sugestoes.value = hist.produtos
      .filter((h) => !conhecidos.some((nome) => mesmoNome(nome, h.descricao)))
      .sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'))
      .map((h) => ({ nome: h.descricao, ultimoPreco: h.ultimoPreco, acao: 'novo' }))
  } catch {
    toast.error('Não foi possível carregar os itens comprados.')
    modalImportar.value = false
  } finally {
    carregandoImportar.value = false
  }
}

const novosImportar = computed(() => sugestoes.value.filter((s) => s.acao === 'novo'))
const decididosImportar = computed(() => sugestoes.value.filter((s) => s.acao !== 'depois'))

function marcarTodosImportar(acao: 'novo' | 'depois') {
  sugestoes.value.forEach((s) => (s.acao = acao))
}

async function importar() {
  if (!decididosImportar.value.length) return
  importando.value = true
  try {
    const vinculos = decididosImportar.value.filter((s) => s.acao !== 'novo')
    for (const s of vinculos) {
      await vincularNomeCompraReposicao(s.nome, s.acao === 'ignorar' ? null : s.acao)
    }
    const n = novosImportar.value.length ? await importarProdutosReposicao(novosImportar.value) : 0
    const partes: string[] = []
    if (n) partes.push(n === 1 ? '1 produto cadastrado' : `${n} produtos cadastrados`)
    const ligados = vinculos.filter((s) => s.acao !== 'ignorar').length
    if (ligados) partes.push(ligados === 1 ? '1 nome ligado a um produto' : `${ligados} nomes ligados a produtos`)
    const ignorados = vinculos.length - ligados
    if (ignorados) partes.push(ignorados === 1 ? '1 item ignorado' : `${ignorados} itens ignorados`)
    toast.success(`${partes.join(', ')}.`)
    modalImportar.value = false
    await carregar()
    emit('alterou')
  } catch (e) {
    toast.error(mensagemErroReposicao(e, 'Não foi possível salvar.'))
  } finally {
    importando.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative sm:w-72">
        <MagnifyingGlassIcon class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          v-model="busca"
          type="search"
          placeholder="Buscar produto ou fornecedor"
          class="w-full rounded-lg border border-zinc-700 bg-zinc-950 py-2 pl-9 pr-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
        />
      </div>
      <div class="flex flex-wrap gap-2">
        <AppButton variant="outline" size="sm" @click="abrirImportar">
          <ArrowDownOnSquareStackIcon class="h-4 w-4" /> Puxar de Itens comprados
        </AppButton>
        <AppButton variant="primary" size="sm" @click="abrir(null)">
          <PlusIcon class="h-4 w-4" /> Novo produto
        </AppButton>
      </div>
    </div>

    <p v-if="erro" class="rounded-xl border border-red-400/30 bg-red-400/5 p-4 text-sm text-red-300">{{ erro }}</p>

    <div v-if="carregando && !produtos.length" class="flex items-center gap-3 p-6 text-sm text-zinc-400">
      <span class="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" aria-hidden="true" />
      Carregando...
    </div>

    <div
      v-else-if="!produtos.length && !erro"
      class="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400"
    >
      Nenhum produto cadastrado ainda.
      <span class="mt-1 block text-xs text-zinc-500">
        Cadastre o que vocês pedem toda semana (bebidas, gelo, descartáveis...) ou puxe os produtos que já aparecem em
        "Itens comprados".
      </span>
    </div>

    <p v-else-if="!filtrados.length" class="p-4 text-sm text-zinc-400">Nenhum produto encontrado.</p>

    <div v-for="g in grupos" :key="g.fornecedor ?? ''" class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <p class="border-b border-zinc-800 bg-zinc-950/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {{ g.fornecedor ?? 'Sem fornecedor' }}
        <span class="font-normal normal-case text-zinc-500">· {{ g.produtos.length }}</span>
      </p>
      <ul class="divide-y divide-zinc-800">
        <li v-for="p in g.produtos" :key="p.id" class="flex items-center gap-3 px-4 py-3" :class="p.ativo ? '' : 'opacity-50'">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-zinc-100">
              {{ p.nome }}
              <span v-if="!p.ativo" class="ml-1 rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">inativo</span>
            </p>
            <p class="text-xs text-zinc-500">
              <span class="text-zinc-400">{{ descreverEmbalagem(p) }}</span>
              <template v-if="p.ultimoPreco !== null"> · {{ formatMoeda(p.ultimoPreco) }} / {{ nomeEmbalagem(p) }}</template>
            </p>
            <p class="text-xs text-zinc-500">
              Ideal na semana: <span class="text-zinc-300">{{ unidadesComEmbalagens(p.quantidadeIdeal, p) }}</span>
            </p>
            <p v-if="consumoDe(p.id)" class="text-xs text-amber-300/90">
              Saiu no bar: ~{{ unidadesComEmbalagens(consumoUnidades(p.id, p.unidadesPorEmbalagem)!, p) }} por semana
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 cursor-pointer rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400"
            :aria-label="`Editar ${p.nome}`"
            @click="abrir(p)"
          >
            <PencilSquareIcon class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </div>

    <!-- Produto -->
    <BaseModal :open="modal" :title="form.id ? 'Editar produto' : 'Novo produto'" @close="modal = false">
      <form class="space-y-4" @submit.prevent="salvar">
        <FormField label="Nome do produto" required :error="erros.nome">
          <BaseInput v-model="form.nome" placeholder="Ex.: Skol lata 350ml" :invalid="!!erros.nome" />
        </FormField>
        <div class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <p class="text-xs font-semibold uppercase tracking-wide text-zinc-400">Embalagem de compra</p>
          <button
            v-if="embalagemDoNome"
            type="button"
            class="block cursor-pointer text-left text-xs text-amber-400 hover:underline"
            @click="usarEmbalagemDoNome"
          >
            O nome diz que vem {{ embalagemDoNome.unidadesPorEmbalagem }}: usar {{ embalagemDoNome.unidade }} com
            {{ embalagemDoNome.unidadesPorEmbalagem }}
          </button>
          <SegmentedControl v-model="form.tipoCompra" :options="tipoCompraOptions" @update:model-value="aoTrocarTipoCompra" />
          <FormField v-if="form.tipoCompra === 'UNIDADE'" label="Unidade" hint="unidade, saco, kg, garrafa...">
            <input v-model="form.unidade" list="reposicao-unidades" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
            <datalist id="reposicao-unidades">
              <option v-for="u in UNIDADES_AVULSAS" :key="u" :value="u" />
            </datalist>
          </FormField>
          <template v-else>
            <div class="grid grid-cols-2 gap-3">
              <FormField label="Embalagem">
                <BaseSelect v-model="form.unidade" :options="embalagemOptions" />
              </FormField>
              <FormField label="Quantas unidades vêm" :error="erros.porEmbalagem">
                <input v-model="form.porEmbalagem" inputmode="decimal" placeholder="Ex.: 12" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30" :class="erros.porEmbalagem ? 'border-red-500/60' : ''" />
              </FormField>
            </div>
            <FormField label="Cada unidade é uma" hint="Para contar as soltas: lata, garrafa...">
              <input v-model="form.avulsa" list="reposicao-avulsas" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
              <datalist id="reposicao-avulsas">
                <option v-for="u in AVULSAS" :key="u" :value="u" />
              </datalist>
            </FormField>
          </template>
        </div>
        <FormField
          :label="porEmbalagemForm > 1 ? `Quantidade ideal na semana (em ${unidadeComPlural(formEmbalagem.unidadeAvulsa, 2)})` : 'Quantidade ideal na semana'"
          :error="erros.ideal"
          :hint="idealFormEquivale ? `= ${idealFormEquivale}` : ''"
        >
          <input v-model="form.ideal" inputmode="decimal" placeholder="Ex.: 120" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30" :class="erros.ideal ? 'border-red-500/60' : ''" />
          <button
            v-if="consumoDe(form.id)"
            type="button"
            class="mt-1 cursor-pointer text-left text-xs text-amber-400 hover:underline"
            @click="form.ideal = quantidadeParaTexto(idealPeloConsumo(consumoUnidades(form.id, porEmbalagemForm)!))"
          >
            Usar o consumo do bar: {{ quantidadeParaTexto(idealPeloConsumo(consumoUnidades(form.id, porEmbalagemForm)!)) }}
            (média ~{{ quantidadeParaTexto(consumoUnidades(form.id, porEmbalagemForm)) }} + 20% de folga)
          </button>
        </FormField>
        <FormField label="Fornecedor" hint="Os pedidos são separados por fornecedor.">
          <input v-model="form.fornecedor" list="reposicao-fornecedores" placeholder="Ex.: Distribuidora Ambev" class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-amber-400/60 focus:outline-none focus:ring-2 focus:ring-amber-400/30" />
          <datalist id="reposicao-fornecedores">
            <option v-for="f in fornecedores" :key="f" :value="f" />
          </datalist>
        </FormField>
        <FormField :label="`Último preço (de 1 ${nomeEmbalagem(formEmbalagem)})`" :error="erros.preco">
          <BaseInput v-model="form.preco" prefix="R$" placeholder="0,00" :invalid="!!erros.preco" />
        </FormField>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
          <input v-model="form.ativo" type="checkbox" class="h-4 w-4 accent-amber-400" />
          Ativo (aparece no pedido da semana)
        </label>
        <button type="submit" class="hidden" />
      </form>
      <template #footer>
        <div class="flex items-center justify-between gap-2">
          <AppButton v-if="form.id" variant="ghost" size="sm" @click="excluindo = produtos.find((p) => p.id === form.id) ?? null">
            <TrashIcon class="h-4 w-4" /> Excluir
          </AppButton>
          <span v-else />
          <div class="flex gap-2">
            <AppButton variant="ghost" @click="modal = false">Cancelar</AppButton>
            <AppButton variant="primary" :disabled="salvando" @click="salvar">
              {{ salvando ? 'Salvando...' : 'Salvar' }}
            </AppButton>
          </div>
        </div>
      </template>
    </BaseModal>

    <ConfirmDialog
      :open="!!excluindo"
      title="Excluir produto?"
      :description="`${excluindo?.nome ?? ''} sai da lista de produtos e do pedido em aberto. Os pedidos antigos continuam guardados. Se só não quiser pedir por um tempo, desmarque 'Ativo'.`"
      confirm-label="Excluir"
      tone="danger"
      :loading="excluindoCarregando"
      @confirm="confirmarExclusao"
      @cancel="excluindo = null"
    />

    <!-- Importar -->
    <BaseModal
      :open="modalImportar"
      title="Puxar de Itens comprados"
      subtitle="Produtos lidos dos comprovantes que ainda não estão ligados a nenhum produto daqui."
      size="lg"
      @close="modalImportar = false"
    >
      <div v-if="carregandoImportar" class="flex items-center gap-3 p-4 text-sm text-zinc-400">
        <span class="h-5 w-5 animate-spin rounded-full border-2 border-amber-400/30 border-t-amber-400" aria-hidden="true" />
        Carregando...
      </div>
      <p v-else-if="!sugestoes.length" class="text-sm text-zinc-400">
        Não há produtos novos em "Itens comprados". Todos já estão cadastrados (ou ainda não há comprovantes com itens).
      </p>
      <template v-else>
        <p class="mb-3 text-xs text-zinc-400">
          Se algum já está cadastrado com outro nome, escolha "É o mesmo que" e ele não aparece mais aqui.
        </p>
        <div class="mb-3 flex items-center justify-between text-xs">
          <span class="text-zinc-400">{{ novosImportar.length }} novo(s) de {{ sugestoes.length }}</span>
          <span class="flex gap-3">
            <button type="button" class="cursor-pointer text-amber-400 hover:underline" @click="marcarTodosImportar('novo')">Todos como novos</button>
            <button type="button" class="cursor-pointer text-zinc-400 hover:underline" @click="marcarTodosImportar('depois')">Todos para depois</button>
          </span>
        </div>
        <ul class="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
          <li v-for="s in sugestoes" :key="s.nome" class="space-y-2 px-3 py-2.5">
            <div class="flex items-center gap-3">
              <span class="min-w-0 flex-1 text-sm text-zinc-100">{{ s.nome }}</span>
              <span v-if="s.ultimoPreco !== null" class="shrink-0 text-xs text-zinc-500">{{ formatMoeda(s.ultimoPreco) }}</span>
            </div>
            <BaseSelect v-model="s.acao" :options="acaoImportarOptions" />
          </li>
        </ul>
        <p class="mt-3 text-xs text-zinc-500">
          Depois de puxar, edite cada produto para conferir a embalagem (fardo com 12, caixa...), o fornecedor e a quantidade ideal.
        </p>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <AppButton variant="ghost" @click="modalImportar = false">Cancelar</AppButton>
          <AppButton variant="primary" :disabled="importando || !decididosImportar.length" @click="importar">
            {{ importando ? 'Salvando...' : 'Salvar' }}
          </AppButton>
        </div>
      </template>
    </BaseModal>
  </div>
</template>
