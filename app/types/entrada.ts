export type EntryMethod = 'QR_CODE' | 'NOME'

export type EntryState = 'ATIVA' | 'ANULADA'

export interface EntryListItem {
  id: string
  ingressoId: string
  ingressoCodigo: string
  participanteNome: string

  pedidoId: string
  pedidoCodigo: string

  eventoId: string
  eventoNome: string

  usuarioId: string
  usuarioNome: string

  metodo: EntryMethod
  entradaEm: string

  anuladaEm: string | null
  anuladaPorUsuarioId: string | null
  anuladaPorUsuarioNome: string | null
  motivoAnulacao: string | null

  criadoEm: string
}

export type EntryMethodFilter = 'TODOS' | EntryMethod

export type EntryStateFilter = 'TODOS' | EntryState

export type EntryPeriodFilter = 'TODAS' | 'HOJE' | 'SETE_DIAS' | 'TRINTA_DIAS'

export interface EntryFiltersState {
  busca: string
  eventoId: string
  metodo: EntryMethodFilter
  situacao: EntryStateFilter
  periodo: EntryPeriodFilter
}

export type EntrySort = 'RECENTES' | 'ANTIGAS' | 'PARTICIPANTE_AZ'

export interface EntrySummaryData {
  total: number
  ativas: number
  anuladas: number
  qrCode: number
  nome: number
}
