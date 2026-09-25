export type CheckoutStep =
  | 'QUANTIDADE'
  | 'PARTICIPANTES'
  | 'COMPRADOR'
  | 'REVISAO'
  | 'RESERVA_CRIADA'

export interface CheckoutParticipant {
  nome: string
}

export interface CheckoutBuyer {
  nome: string
  telefone: string
  email: string
}

export interface CheckoutDraft {
  quantidade: number
  participantes: CheckoutParticipant[]
  comprador: CheckoutBuyer
}

/**
 * Reserva mock (nao persistida). Reflete o contrato futuro de `criar_reserva`
 * onde o banco e a fonte de verdade de lote, valor, expiracao e codigo.
 */
export interface CheckoutReservationMock {
  pedidoId: string
  codigo: string
  eventoId: string
  loteId: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
  expiraEm: string
  status: 'RESERVADO'
}

export interface CheckoutBuyerErrors {
  nome: string
  telefone: string
  email: string
}
