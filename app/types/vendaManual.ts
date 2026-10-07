import type { EventStatus } from '~/types/evento'

export type EventoStatusVendaManual = Extract<EventStatus, 'AGENDADO' | 'EM_ANDAMENTO'>

export interface VendaManualLoteAtivo {
  id: string
  nome: string
  preco: number
  disponiveis: number
}

export interface EventoVendaManual {
  id: string
  nome: string
  inicioEm: string
  local: string
  status: EventoStatusVendaManual
  loteAtivo: VendaManualLoteAtivo | null
}

/** Linha bruta de public.listar_eventos_venda_manual_admin. */
export interface AdminEventoVendaManualRow {
  evento_id: string
  nome: string
  inicio_em: string
  local: string
  status: string
  lote_ativo_id: string | null
  lote_ativo_nome: string | null
  lote_ativo_preco: number | string | null
  lote_ativo_disponiveis: number | null
}

export interface VendaManualForm {
  eventoId: string
  loteId: string
  compradorNome: string
  compradorTelefone: string
  compradorEmail: string
  quantidade: number
  participantes: string[]
}

export interface CriarVendaManualInput {
  eventoId: string
  loteId: string
  compradorNome: string
  compradorTelefone: string
  compradorEmail: string | null
  participantes: string[]
}

export interface CriarVendaManualResult {
  pedidoId: string
  codigoPedido: string
  quantidade: number
  valorUnitario: number
  valorTotal: number
}
