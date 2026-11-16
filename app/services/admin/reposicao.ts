import type {
  ConsumoBar,
  PedidoReposicao,
  PreviaRelatorioBar,
  ProdutoReposicao,
  VendaBar,
  VinculoBar
} from '~/types/reposicao'
import {
  mapearConsumoBar,
  mapearPedidoReposicao,
  mapearPreviaRelatorioBar,
  mapearProdutoReposicao,
  mapearVendaBar,
  mapearVinculoBar
} from '~/utils/reposicao'

// Reposicao semanal de estoque: RPCs seguras (somente ADMINISTRADOR).
// Os erros sobem como estao para a tela traduzir com mensagemErroReposicao().

type Bruto = Record<string, unknown>

export async function listarProdutosReposicao(): Promise<ProdutoReposicao[]> {
  const { data, error } = await useSupabaseClient().rpc('listar_reposicao_produtos_admin')
  if (error) throw error
  return ((data ?? []) as Bruto[]).map(mapearProdutoReposicao)
}

export async function salvarProdutoReposicao(input: {
  id: string | null
  nome: string
  unidade: string
  fornecedor: string
  ultimoPreco: number | null
  quantidadeIdeal: number
  ativo: boolean
  unidadesPorEmbalagem: number
  unidadeAvulsa: string
}): Promise<ProdutoReposicao> {
  const { data, error } = await useSupabaseClient().rpc('salvar_reposicao_produto_admin', {
    p_id: input.id,
    p_nome: input.nome.trim(),
    p_unidade: input.unidade.trim(),
    p_fornecedor: input.fornecedor.trim() || null,
    p_ultimo_preco: input.ultimoPreco,
    p_quantidade_ideal: input.quantidadeIdeal,
    p_ativo: input.ativo,
    p_unidades_por_embalagem: input.unidadesPorEmbalagem,
    p_unidade_avulsa: input.unidadeAvulsa.trim() || 'unidade'
  })
  if (error) throw error
  return mapearProdutoReposicao(data as Bruto)
}

export async function excluirProdutoReposicao(id: string): Promise<void> {
  const { error } = await useSupabaseClient().rpc('excluir_reposicao_produto_admin', { p_id: id })
  if (error) throw error
}

export async function importarProdutosReposicao(
  itens: { nome: string; ultimoPreco: number | null }[]
): Promise<number> {
  const { data, error } = await useSupabaseClient().rpc('importar_reposicao_produtos_admin', {
    p_itens: itens.map((i) => ({ nome: i.nome, ultimo_preco: i.ultimoPreco }))
  })
  if (error) throw error
  return Number((data as Bruto)?.importados ?? 0)
}

/** Nomes das notas ja ligados a um produto (ou ignorados: produtoId nulo). */
export async function listarNomesCompraReposicao(): Promise<{ nome: string; produtoId: string | null }[]> {
  const { data, error } = await useSupabaseClient().rpc('listar_reposicao_nomes_compra_admin')
  if (error) throw error
  return ((data as Bruto[] | null) ?? []).map((n) => ({
    nome: String(n.nome ?? ''),
    produtoId: n.produto_id ? String(n.produto_id) : null
  }))
}

/** Liga um nome da nota a um produto ja cadastrado; produtoId nulo = nao e de reposicao. */
export async function vincularNomeCompraReposicao(nome: string, produtoId: string | null): Promise<void> {
  const { error } = await useSupabaseClient().rpc('vincular_reposicao_nome_compra_admin', {
    p_nome: nome,
    p_produto_id: produtoId
  })
  if (error) throw error
}

export async function obterPedidoAbertoReposicao(): Promise<PedidoReposicao | null> {
  const { data, error } = await useSupabaseClient().rpc('obter_reposicao_pedido_aberto_admin')
  if (error) throw error
  return data ? mapearPedidoReposicao(data as Bruto) : null
}

export async function iniciarPedidoReposicao(): Promise<PedidoReposicao> {
  const { data, error } = await useSupabaseClient().rpc('iniciar_reposicao_pedido_admin')
  if (error) throw error
  return mapearPedidoReposicao(data as Bruto)
}

export async function salvarItemPedidoReposicao(input: {
  id: string
  estoqueAtual: number | null
  estoqueFechados: number | null
  estoqueSoltos: number | null
  quantidade: number
  pedidoFeito: boolean
}): Promise<void> {
  const { error } = await useSupabaseClient().rpc('salvar_reposicao_pedido_item_admin', {
    p_item_id: input.id,
    p_estoque_atual: input.estoqueAtual,
    p_quantidade: input.quantidade,
    p_pedido_feito: input.pedidoFeito,
    p_estoque_fechados: input.estoqueFechados,
    p_estoque_soltos: input.estoqueSoltos
  })
  if (error) throw error
}

export async function finalizarPedidoReposicao(id: string): Promise<void> {
  const { error } = await useSupabaseClient().rpc('finalizar_reposicao_pedido_admin', { p_pedido_id: id })
  if (error) throw error
}

export async function descartarPedidoReposicao(id: string): Promise<void> {
  const { error } = await useSupabaseClient().rpc('descartar_reposicao_pedido_admin', { p_pedido_id: id })
  if (error) throw error
}

export async function listarPedidosReposicao(limite = 20): Promise<PedidoReposicao[]> {
  const { data, error } = await useSupabaseClient().rpc('listar_reposicao_pedidos_admin', { p_limite: limite })
  if (error) throw error
  return ((data ?? []) as Bruto[]).map(mapearPedidoReposicao)
}

// --- Vendas do bar -----------------------------------------------------------

/** Le o relatorio do bar pelo link ou pelo HTML do arquivo (nao salva nada). */
export async function lerRelatorioBar(entrada: { url: string } | { html: string }): Promise<PreviaRelatorioBar> {
  const r = await $fetch<Bruto>('/api/admin/reposicao/relatorio-bar', { method: 'POST', body: entrada })
  return mapearPreviaRelatorioBar(r)
}

export async function salvarVendaBar(input: {
  previa: PreviaRelatorioBar
  eventoId: string | null
}): Promise<VendaBar> {
  const { data, error } = await useSupabaseClient().rpc('salvar_bar_venda_admin', {
    p_de: input.previa.de,
    p_ate: input.previa.ate,
    p_evento_id: input.eventoId,
    p_origem: input.previa.origem,
    p_itens: input.previa.produtos.map((p) => ({
      grupo: p.grupo,
      codigo: p.codigo,
      descricao: p.descricao,
      quantidade: p.quantidade,
      valor: p.valor
    }))
  })
  if (error) throw error
  return mapearVendaBar(data as Bruto)
}

export async function listarVendasBar(limite = 30): Promise<VendaBar[]> {
  const { data, error } = await useSupabaseClient().rpc('listar_bar_vendas_admin', { p_limite: limite })
  if (error) throw error
  return ((data ?? []) as Bruto[]).map(mapearVendaBar)
}

export async function excluirVendaBar(id: string): Promise<void> {
  const { error } = await useSupabaseClient().rpc('excluir_bar_venda_admin', { p_id: id })
  if (error) throw error
}

export async function listarVinculosBar(): Promise<VinculoBar[]> {
  const { data, error } = await useSupabaseClient().rpc('listar_bar_produtos_vinculo_admin')
  if (error) throw error
  return ((data ?? []) as Bruto[]).map(mapearVinculoBar)
}

export async function salvarVinculoBar(input: {
  codigo: string
  produtoId: string | null
  vendasPorUnidade: number
}): Promise<void> {
  const { error } = await useSupabaseClient().rpc('salvar_bar_produto_vinculo_admin', {
    p_codigo: input.codigo,
    p_produto_id: input.produtoId,
    p_vendas_por_unidade: input.vendasPorUnidade
  })
  if (error) throw error
}

export async function obterConsumoBar(semanas = 4): Promise<ConsumoBar> {
  const { data, error } = await useSupabaseClient().rpc('listar_consumo_bar_reposicao_admin', { p_semanas: semanas })
  if (error) throw error
  return mapearConsumoBar(data as Bruto)
}
