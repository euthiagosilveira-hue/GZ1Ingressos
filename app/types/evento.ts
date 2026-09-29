export type EventStatus =
  | 'AGENDADO'
  | 'EM_ANDAMENTO'
  | 'REALIZADO'
  | 'CANCELADO'

export type SalesStatus =
  | 'ABERTAS'
  | 'ENCERRADAS'

export type PublicationStatus =
  | 'RASCUNHO'
  | 'PUBLICADO'

export interface EventLoteAtual {
  id: string
  nome: string
  preco: number
}

export interface EventListItem {
  id: string
  nome: string
  slug: string
  imagemUrl: string | null
  inicioEm: string
  local: string
  status: EventStatus
  vendasStatus: SalesStatus
  publicacaoStatus: PublicationStatus

  loteAtual: EventLoteAtual | null

  vendidos: number
  disponiveis: number
}

export type EventStatusFilter = 'TODOS' | EventStatus

export type EventPublicationFilter = 'TODOS' | PublicationStatus

export interface EventFiltersState {
  busca: string
  status: EventStatusFilter
  publicacao: EventPublicationFilter
}

export interface EventFormValue {
  nome: string
  slug: string
  descricao: string
  imagemUrl: string | null
  dataInicio: string
  horaInicio: string
  local: string
  endereco: string
  capacidadeTotal: number | null
  estoqueAntecipado: number | null
  publicacaoStatus: PublicationStatus
  vendasStatus: SalesStatus
  status: 'AGENDADO'
}

export type EventFormField = keyof EventFormValue

export type EventFormErrors = Partial<Record<EventFormField, string>>

export interface EventPayload {
  nome: string
  slug: string
  descricao: string
  imagemUrl: string | null
  inicioEm: string
  local: string
  endereco: string
  capacidadeTotal: number
  estoqueAntecipado: number
  status: 'AGENDADO'
  vendasStatus: SalesStatus
  publicacaoStatus: PublicationStatus
}

export type EventFormMode = 'create' | 'edit'

/** Item da listagem administrativa (public.listar_eventos_admin_filtrado). */
export interface AdminEventListItem {
  eventoId: string
  nome: string
  slug: string
  inicioEm: string
  local: string
  status: EventStatus
  vendasStatus: SalesStatus
  publicacaoStatus: PublicationStatus
  capacidadeTotal: number
  estoqueAntecipado: number
  publicadoEm: string | null
  lotesCount: number
  pedidosCount: number
  ingressosCount: number
}
