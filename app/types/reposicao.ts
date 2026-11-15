// Reposicao semanal de estoque (Financeiro > Reposicao).

export interface ProdutoReposicao {
  id: string
  nome: string
  unidade: string
  fornecedor: string | null
  ultimoPreco: number | null
  quantidadeIdeal: number
  ativo: boolean
}

export interface ItemPedidoReposicao {
  id: string
  produtoId: string | null
  nome: string
  unidade: string
  fornecedor: string | null
  preco: number | null
  quantidadeIdeal: number
  estoqueAtual: number | null
  quantidade: number
  pedidoFeito: boolean
  pedidoFeitoEm: string | null
}

export interface PedidoReposicao {
  id: string
  status: 'ABERTO' | 'FINALIZADO'
  criadoEm: string
  finalizadoEm: string | null
  itens: ItemPedidoReposicao[]
}

export interface GrupoFornecedor {
  fornecedor: string | null
  itens: ItemPedidoReposicao[]
}
