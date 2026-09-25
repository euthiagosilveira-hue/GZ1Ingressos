export type PaymentStatus =
  | 'PENDENTE'
  | 'APROVADO'
  | 'REJEITADO'
  | 'CANCELADO'
  | 'EXPIRADO'
  | 'REEMBOLSADO'

export interface OrderPayment {
  id: string
  status: PaymentStatus
  valor: number
  provider: PaymentProvider
  transactionId: string | null
  chargeId: string | null
  externalReference: string
  expiraEm: string | null
  confirmadoEm: string | null
  canceladoEm: string | null
  reembolsadoEm: string | null
  valorReembolsado: number
}

export type PaymentProvider = 'STONE' | 'MERCADO_PAGO'

/**
 * Status financeiro normalizado do GZ1.
 * A futura integração com a Stone terá uma camada de mapeamento
 * (status/eventos Stone → status interno GZ1) no backend.
 * O frontend NÃO deve espalhar strings de status da Stone.
 */
export type FinancialPaymentStatus = PaymentStatus

export interface PaymentListItem {
  id: string
  pedidoId: string
  pedidoCodigo: string
  eventoId: string
  eventoNome: string
  compradorNome: string
  provider: PaymentProvider
  valor: number
  status: FinancialPaymentStatus
  transactionId: string
  chargeId: string
  externalReference: string
  criadoEm: string
  expiraEm: string | null
  confirmadoEm: string | null
  canceladoEm: string | null
  reembolsadoEm: string | null
  valorReembolsado: number
}

export type FinancialStatusFilter = 'TODOS' | FinancialPaymentStatus

export type FinancialPeriodFilter = 'TODAS' | 'HOJE' | 'SETE_DIAS' | 'TRINTA_DIAS'

export interface FinancialFiltersState {
  busca: string
  eventoId: string
  status: FinancialStatusFilter
  periodo: FinancialPeriodFilter
}

export type FinancialSort = 'RECENTES' | 'ANTIGOS' | 'MAIOR_VALOR' | 'MENOR_VALOR'

export interface FinancialSummaryData {
  total: number
  aprovados: number
  valorAprovado: number
  pendente: number
  reembolsado: number
  liquido: number
}
