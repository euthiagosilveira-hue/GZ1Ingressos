export interface AdminDashboardMetrics {
  vendidos: number
  utilizados: number
  naoEntraram: number
  faturamento: number
  ticketMedio: number
}

export interface AdminDashboardEvento {
  id: string
  nome: string
  slug: string
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

export interface AdminDashboardData {
  metricas: AdminDashboardMetrics
  evento: AdminDashboardEvento | null
  entradasPorHora: AdminDashboardEntryByHour[]
  pagamentosPorStatus: AdminDashboardPaymentSlice[]
  pedidosRecentes: AdminDashboardOrder[]
  entradasRecentes: AdminDashboardEntry[]
}
