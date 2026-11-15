import type { PedidoReposicao, ProdutoReposicao } from '~/types/reposicao'
import { mapearPedidoReposicao, mapearProdutoReposicao } from '~/utils/reposicao'

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
}): Promise<ProdutoReposicao> {
  const { data, error } = await useSupabaseClient().rpc('salvar_reposicao_produto_admin', {
    p_id: input.id,
    p_nome: input.nome.trim(),
    p_unidade: input.unidade.trim(),
    p_fornecedor: input.fornecedor.trim() || null,
    p_ultimo_preco: input.ultimoPreco,
    p_quantidade_ideal: input.quantidadeIdeal,
    p_ativo: input.ativo
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
  quantidade: number
  pedidoFeito: boolean
}): Promise<void> {
  const { error } = await useSupabaseClient().rpc('salvar_reposicao_pedido_item_admin', {
    p_item_id: input.id,
    p_estoque_atual: input.estoqueAtual,
    p_quantidade: input.quantidade,
    p_pedido_feito: input.pedidoFeito
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
