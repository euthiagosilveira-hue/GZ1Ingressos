// Caixa da galeria (Financeiro fase 1): contas, categorias, lancamentos e fluxo.

export type TipoConta = 'BANCO' | 'MAQUININHA' | 'DINHEIRO' | 'ONLINE'
export type TipoCategoria = 'ENTRADA' | 'SAIDA'
export type TipoLancamento = 'ENTRADA' | 'SAIDA' | 'TRANSFERENCIA'
export type OrigemLancamento = 'MANUAL' | 'INGRESSO' | 'REEMBOLSO'
export type Agrupamento = 'dia' | 'semana' | 'mes'

export interface ContaCaixa {
  id: string
  nome: string
  tipo: TipoConta
  provedorIngressos: string | null
  saldoInicial: number
  saldoInicialEm: string | null
  configurada: boolean
  ativa: boolean
  saldoAtual: number
}

export interface CategoriaCaixa {
  id: string
  nome: string
  tipo: TipoCategoria
  chaveSistema: string | null
  ativa: boolean
}

export interface LancamentoCaixa {
  id: string
  origem: OrigemLancamento
  lancamentoId: string | null
  pagamentoId: string | null
  pedidoId: string | null
  tipo: TipoLancamento
  data: string
  ocorridoEm: string | null
  valor: number
  descricao: string
  categoriaId: string | null
  categoriaNome: string
  contaId: string | null
  contaNome: string
  contaDestinoId: string | null
  contaDestinoNome: string
  eventoId: string | null
  eventoNome: string
  comprovantePath: string | null
  grupoId: string | null
  canceladoEm: string | null
  motivoCancelamento: string
  criadoPorNome: string
}

export interface ResumoLancamentos {
  entradas: number
  saidas: number
  transferenciasEntrada: number
  transferenciasSaida: number
  quantidade: number
}

export interface FiltrosLancamentos {
  de: string | null
  ate: string | null
  contaId: string | null
  categoriaId: string | null
  eventoId: string | null
  tipo: TipoLancamento | null
  busca: string
  incluirCancelados: boolean
}

export interface LancamentoInput {
  id: string | null
  tipo: TipoLancamento
  data: string
  valor: number
  descricao: string
  categoriaId: string | null
  contaId: string
  contaDestinoId: string | null
  eventoId: string | null
  comprovantePath: string | null
  /** Itens do comprovante (null = nao mexer nos itens ja salvos). */
  itens: ItemLancamento[] | null
}

/** Um produto do comprovante (ex.: "6x RED LABEL 1L = R$ 419,40"). */
export interface ItemLancamento {
  descricao: string
  quantidade: number
  valorTotal: number
}

export interface ItemHistorico extends ItemLancamento {
  id: string
  valorUnitario: number | null
  lancamentoId: string
  tipo: TipoLancamento
  data: string
  lancamentoDescricao: string | null
  comprovantePath: string | null
  categoriaNome: string | null
  contaNome: string | null
  eventoNome: string | null
}

export interface ProdutoHistorico {
  descricao: string
  compras: number
  quantidade: number
  valorTotal: number
  precoMedio: number | null
  ultimoPreco: number | null
  ultimaData: string | null
  menorPreco: number | null
  maiorPreco: number | null
}

export interface HistoricoItens {
  totais: { itens: number; valorTotal: number }
  produtos: ProdutoHistorico[]
  itens: ItemHistorico[]
}

export interface PeriodoFluxo {
  inicio: string
  fim: string
  entradas: number
  saidas: number
  resultado: number
  saldo: number | null
}

export interface CategoriaFluxo {
  categoriaId: string | null
  categoriaNome: string
  tipo: TipoCategoria
  total: number
}

export interface FluxoCaixa {
  de: string
  ate: string
  agrupamento: Agrupamento
  totais: {
    entradas: number
    saidas: number
    saldoInicial: number | null
    saldoFinal: number | null
  }
  periodos: PeriodoFluxo[]
  porCategoria: CategoriaFluxo[]
}
