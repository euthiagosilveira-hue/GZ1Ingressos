import type {
  AdminDashboardData,
  AdminDashboardEvento,
  AdminDashboardOrder,
  EntryByHour,
  PaymentSlice,
  RecentEntry,
  RecentOrder,
  TodayEvent
} from '~/types/dashboard'
import { imagemValida } from './imagem.ts'

const moedaBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function formatMoeda(valor: number): string {
  return moedaBRL.format(valor)
}

function formatHora(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo'
  }).format(data)
}

function formatData(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  }).format(data)
}

const CORES: Record<string, string> = {
  paid: '#22c55e',
  pending: '#fbbf24',
  canceled: '#ef4444'
}

function nomeDiaSemana(iso: string): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    timeZone: 'America/Sao_Paulo'
  }).format(data)
}

function diaMes(iso: string): { dia: string; mes: string } {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return { dia: '', mes: '' }
  const dia = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    timeZone: 'America/Sao_Paulo'
  }).format(data)
  const mes = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    timeZone: 'America/Sao_Paulo'
  })
    .format(data)
    .replace('.', '')
    .toUpperCase()
  return { dia, mes }
}

const BADGES: Record<string, string> = {
  EM_ANDAMENTO: 'AO VIVO',
  AGENDADO: 'PRÓXIMO',
  REALIZADO: 'REALIZADO',
  CANCELADO: 'CANCELADO'
}

/** URL publica completa da pagina de venda do evento. */
export function urlPublicaEvento(siteUrl: string | null | undefined, origemAtual: string, href: string): string {
  if (!href) return ''
  const base = String(siteUrl || origemAtual).replace(/\/+$/, '')
  return `${base}${href}`
}

/** Le o id do evento do filtro (?evento=...) na URL do dashboard. */
export function eventoDoFiltro(valor: unknown): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor
  if (typeof v !== 'string') return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null
}

/** Periodos oferecidos no filtro do dashboard (valor da URL ?periodo=). */
export const PERIODOS_DASHBOARD = ['7', '15', '30', '90', 'todos'] as const

/** Le o periodo do filtro (?periodo=...); invalido ou vazio = evento atual. */
export function periodoDoFiltro(valor: unknown): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor
  if (typeof v !== 'string') return null
  return (PERIODOS_DASHBOARD as readonly string[]).includes(v) ? v : null
}

/** Valor do seletor de filtro a partir da URL: 'atual', 'periodo:30', 'evento:<id>'. */
export function valorSeletorFiltro(eventoId: string | null, periodo: string | null): string {
  if (eventoId) return `evento:${eventoId}`
  if (periodo) return `periodo:${periodo}`
  return 'atual'
}

/** Rota do dashboard para um valor do seletor de filtro. */
export function rotaDoSeletorFiltro(valor: string): string {
  if (valor.startsWith('evento:')) return `/?evento=${encodeURIComponent(valor.slice(7))}`
  if (valor.startsWith('periodo:')) return `/?periodo=${encodeURIComponent(valor.slice(8))}`
  return '/'
}

/** Titulo do card de evento conforme o status (evento atual automatico). */
export function tituloCardEvento(status: string | null | undefined, selecionado: boolean): string {
  if (selecionado) return 'Evento selecionado'
  if (status === 'EM_ANDAMENTO') return 'Evento de agora'
  if (status === 'AGENDADO') return 'Próximo evento'
  if (status) return 'Último evento'
  return 'Próximo evento'
}

/**
 * Converte o evento real (EM_ANDAMENTO ou proximo AGENDADO) no view-model do
 * card. A capa usa imagem_url real validada; sem imagem, usa o fallback atual.
 */
export function mapearDashboardEvento(evento: AdminDashboardEvento | null): TodayEvent {
  if (!evento) {
    return {
      hasEvent: false,
      badge: '',
      title: 'Nenhum próximo evento agendado.',
      date: '—',
      time: '—',
      venue: '—',
      imageUrl: null,
      href: '',
      eventoId: '',
      poster: { weekday: '', day: '--', month: '', label: 'EVENTO', name: '—' }
    }
  }

  const { dia, mes } = diaMes(evento.inicio_em)
  const semana = nomeDiaSemana(evento.inicio_em)
  return {
    hasEvent: true,
    badge: BADGES[evento.status] ?? 'PRÓXIMO',
    title: evento.nome,
    date: formatData(evento.inicio_em),
    time: formatHora(evento.inicio_em),
    venue: evento.local ?? '—',
    imageUrl: imagemValida(evento.imagem_url),
    href: `/eventos/${evento.slug}`,
    // RPC legada devolvia 'id' em vez de 'evento_id'
    eventoId: evento.evento_id ?? (evento as { id?: string }).id ?? '',
    poster: {
      weekday: semana ? semana.slice(0, 3).toUpperCase() : '',
      day: dia,
      month: mes,
      label: 'EVENTO',
      name: evento.nome
    }
  }
}

export function mapearEntradasPorHora(
  dados: { hora: string; entradas: number }[]
): EntryByHour[] {
  return dados.map((item) => ({ hora: item.hora, entradas: Number(item.entradas) }))
}

export function mapearPagamentosPorStatus(
  dados: { key: string; label: string; value: number }[]
): PaymentSlice[] {
  return dados.map((item) => ({
    key: item.key as PaymentSlice['key'],
    label: item.label,
    value: Number(item.value),
    color: CORES[item.key] ?? '#71717a'
  }))
}

export function mapearPedidosRecentes(orders: AdminDashboardOrder[]): RecentOrder[] {
  return orders.map((order) => ({
    id: `#${order.codigo}`,
    buyer: order.buyer,
    tickets: Number(order.tickets),
    total: formatMoeda(Number(order.total)),
    payment: order.status === 'PAGO' ? 'Pago' : 'Pendente',
    entranceUsed: Number(order.entrance_used),
    entranceTotal: Number(order.tickets)
  }))
}

const diaSP = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo'
})

/** "Hoje" quando a entrada foi hoje (horario de Brasilia); senao dd/mm. */
export function rotuloDiaEntrada(iso: string, agora: Date = new Date()): string {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return ''
  const dia = diaSP.format(data)
  return dia === diaSP.format(agora) ? 'Hoje' : dia
}

export function mapearEntradasRecentes(
  entries: { id: string; name: string; codigo: string; entrada_em: string; metodo_validacao: string | null }[]
): RecentEntry[] {
  return entries.map((entry) => {
    const dia = rotuloDiaEntrada(entry.entrada_em)
    return {
      id: entry.id,
      name: entry.name,
      ticket: `Ingresso ${entry.codigo}`,
      time: formatHora(entry.entrada_em),
      dateLabel: dia,
      ok: true,
      statusLabel: dia
    }
  })
}

export interface AdminDashboardViewModel {
  metrics: AdminDashboardData['metricas']
  evento: TodayEvent
  entriesByHour: EntryByHour[]
  paymentStatus: PaymentSlice[]
  recentOrders: RecentOrder[]
  recentEntries: RecentEntry[]
}

/** Mapeia o retorno da RPC para as props exatas dos componentes atuais. */
export function mapearDashboard(data: AdminDashboardData): AdminDashboardViewModel {
  return {
    metrics: data.metricas,
    evento: mapearDashboardEvento(data.evento),
    entriesByHour: mapearEntradasPorHora(data.entradasPorHora),
    paymentStatus: mapearPagamentosPorStatus(data.pagamentosPorStatus),
    recentOrders: mapearPedidosRecentes(data.pedidosRecentes),
    recentEntries: mapearEntradasRecentes(data.entradasRecentes)
  }
}
