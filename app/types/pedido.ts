import type { OrderTicket } from '~/types/ingresso'
import type { OrderPayment } from '~/types/pagamento'

export type OrderStatus = 'RESERVADO' | 'PAGO' | 'EXPIRADO' | 'CANCELADO'

export type OrderPriceType = 'LOTE' | 'AVULSO'

export interface OrderListItem {
  id: string
  codigo: string
  eventoId: string
  eventoNome: string
  loteId: string | null
  loteNome: string | null
  compradorNome: string
  telefone: string
  email: string | null
  quantidade: number
  tipoPreco: OrderPriceType
  valorUnitario: number
  valorTotal: number
  status: OrderStatus
  reservaExpiraEm: string | null
  pagoEm: string | null
  canceladoEm: string | null
  criadoEm: string
}

export type OrderStatusFilter = 'TODOS' | OrderStatus

export type OrderPriceTypeFilter = 'TODOS' | OrderPriceType

export interface OrderFiltersState {
  busca: string
  eventoId: string
  status: OrderStatusFilter
  tipoPreco: OrderPriceTypeFilter
}

export type OrderSort = 'RECENTES' | 'ANTIGOS'

export interface OrderSummaryData {
  total: number
  pagos: number
  reservados: number
  expirados: number
  cancelados: number
  valorPago: number
}

export type OrderHistoryType =
  | 'PEDIDO_CRIADO'
  | 'RESERVA_CRIADA'
  | 'PAGAMENTO_INICIADO'
  | 'PAGAMENTO_APROVADO'
  | 'INGRESSOS_LIBERADOS'
  | 'PEDIDO_EXPIRADO'
  | 'PEDIDO_CANCELADO'
  | 'REEMBOLSO_SOLICITADO'
  | 'REEMBOLSO_CONCLUIDO'

export interface OrderHistoryEvent {
  id: string
  tipo: OrderHistoryType
  titulo: string
  descricao?: string | null
  ocorridoEm: string
}

export interface OrderDetail extends OrderListItem {
  atualizadoEm: string | null
  motivoValorAvulso: string | null
  autorizadoPorUsuarioId: string | null
  autorizadoPorNome: string | null
  pagamento: OrderPayment | null
  ingressos: OrderTicket[]
  historico: OrderHistoryEvent[]
}
