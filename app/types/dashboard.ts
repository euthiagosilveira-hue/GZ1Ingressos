export interface AdminDashboardMetrics {
  vendidos: number
  utilizados: number
  naoEntraram: number
  faturamento: number
  ticketMedio: number
}

export interface AdminDashboardEvento {
  evento_id: string
  nome: string
  slug: string
  imagem_url: string | null
  inicio_em: string
  local: string | null
  status: string
}

export interface AdminDashboardEntryByHour {
  hora: string
  entradas: number
}

export interface AdminDashboardPaymentSlice {
  key: string
  label: string
  value: number
}

export interface AdminDashboardOrder {
  pedido_id: string
  codigo: string
  buyer: string
  tickets: number
  total: number | string
  status: string
  criado_em: string
  entrance_used: number
}

export interface AdminDashboardEntry {
  id: string
  name: string
  codigo: string
  entrada_em: string
  metodo_validacao: string | null
}

/** Qual recorte o dashboard esta mostrando. */
export interface AdminDashboardEscopo {
  /** atual = evento de agora/proximo/ultimo; evento = um evento escolhido; periodo = ultimos N dias; todos. */
  modo: 'atual' | 'evento' | 'periodo' | 'todos'
  dias: number | null
  quantidadeEventos: number
}

/** Evento listado no seletor do filtro. */
export interface AdminDashboardEventoOpcao {
  id: string
  nome: string
  inicio_em: string
  status: string
}

export interface AdminDashboardData {
  escopo: AdminDashboardEscopo
  eventos: AdminDashboardEventoOpcao[]
  metricas: AdminDashboardMetrics
  evento: AdminDashboardEvento | null
  entradasPorHora: AdminDashboardEntryByHour[]
  pagamentosPorStatus: AdminDashboardPaymentSlice[]
  pedidosRecentes: AdminDashboardOrder[]
  entradasRecentes: AdminDashboardEntry[]
}

/** View-models usados pelos componentes visuais do dashboard. */
export interface EntryByHour {
  hora: string
  entradas: number
}

export interface PaymentSlice {
  key: 'paid' | 'pending' | 'canceled'
  label: string
  value: number
  color: string
}

export interface RecentOrder {
  id: string
  buyer: string
  tickets: number
  total: string
  payment: 'Pago' | 'Pendente'
  entranceUsed: number
  entranceTotal: number
}

export interface RecentEntry {
  id: string
  name: string
  ticket: string
  time: string
  dateLabel: string
  ok: boolean
  statusLabel: string
}

export interface TodayEvent {
  hasEvent: boolean
  badge: string
  title: string
  date: string
  time: string
  venue: string
  imageUrl: string | null
  /** Caminho da pagina publica de venda (ex.: /eventos/meu-evento). */
  href: string
  /** Id do evento (usado no filtro "Ver evento" do dashboard). */
  eventoId: string
  poster: {
    weekday: string
    day: string
    month: string
    label: string
    name: string
  }
}
