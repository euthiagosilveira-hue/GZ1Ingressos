// Reposicao semanal de estoque (Financeiro > Reposicao).

export interface ProdutoReposicao {
  id: string
  nome: string
  /** Embalagem de compra (fardo, caixa, unidade...). */
  unidade: string
  /** Quantas unidades vem em 1 embalagem (1 = compra avulsa). */
  unidadesPorEmbalagem: number
  /** Nome da unidade solta (lata, garrafa, unidade). */
  unidadeAvulsa: string
  fornecedor: string | null
  /** Preco de 1 embalagem. */
  ultimoPreco: number | null
  quantidadeIdeal: number
  ativo: boolean
}

export interface ItemPedidoReposicao {
  id: string
  produtoId: string | null
  nome: string
  unidade: string
  unidadesPorEmbalagem: number
  unidadeAvulsa: string
  fornecedor: string | null
  /** Preco de 1 embalagem. */
  preco: number | null
  /** Em unidades soltas. */
  quantidadeIdeal: number
  /** Total em unidades soltas. */
  estoqueAtual: number | null
  estoqueFechados: number | null
  estoqueSoltos: number | null
  /** Embalagens a pedir. */
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

// --- Vendas do bar (relatorio do sistema do bar) -----------------------------

export interface ProdutoVendaBar {
  grupo: string | null
  codigo: string
  descricao: string
  quantidade: number
  valor: number
}

/** Relatorio lido (ainda nao salvo). */
export interface PreviaRelatorioBar {
  de: string
  ate: string
  produtos: ProdutoVendaBar[]
  totalValor: number
  totalQuantidade: number
  grupos: { grupo: string; quantidade: number; valor: number }[]
  conferido: boolean
  origem: string | null
}

/** Relatorio ja importado. */
export interface VendaBar {
  id: string
  de: string
  ate: string
  eventoId: string | null
  eventoNome: string | null
  totalValor: number
  totalQuantidade: number
  criadoEm: string
  itens: ProdutoVendaBar[]
}

/** Produto do bar e a ligacao com o produto da Reposicao. */
export interface VinculoBar {
  codigo: string
  descricao: string
  grupo: string | null
  quantidadeTotal: number
  produtoId: string | null
  vendasPorUnidade: number
}

/** Consumo pelo bar, nas unidades do pedido de cada produto da Reposicao. */
export interface ConsumoBar {
  semanas: number
  porProduto: Record<string, { total: number; mediaSemanal: number }>
}
