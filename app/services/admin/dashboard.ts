import type { AdminDashboardData } from '~/types/dashboard'

export interface FiltroDashboard {
  /** Um evento especifico (tem prioridade sobre o periodo). */
  eventoId?: string | null
  /** 'todos' ou numero de dias ('7', '15', '30', '90'). Vazio = evento atual. */
  periodo?: string | null
}

/**
 * Dashboard administrativo real (RPC segura, ADMINISTRADOR).
 * Sem filtro, mostra o evento atual (em andamento, proximo ou ultimo).
 */
export async function obterDashboardAdmin(filtro: FiltroDashboard = {}): Promise<AdminDashboardData> {
  const client = useSupabaseClient()
  const params: Record<string, string> = {}
  if (filtro.eventoId) params.p_evento_id = filtro.eventoId
  else if (filtro.periodo) params.p_periodo = filtro.periodo
  const { data, error } = await client.rpc('obter_dashboard_admin', params)
  if (error) {
    throw new Error('Não foi possível carregar o dashboard.')
  }
  const d = (data ?? {}) as Partial<AdminDashboardData>
  return {
    escopo: d.escopo ?? { modo: 'atual', dias: null, quantidadeEventos: 0 },
    eventos: d.eventos ?? [],
    metricas: d.metricas ?? {
      vendidos: 0,
      utilizados: 0,
      naoEntraram: 0,
      faturamento: 0,
      ticketMedio: 0
    },
    evento: d.evento ?? null,
    entradasPorHora: d.entradasPorHora ?? [],
    pagamentosPorStatus: d.pagamentosPorStatus ?? [],
    pedidosRecentes: d.pedidosRecentes ?? [],
    entradasRecentes: d.entradasRecentes ?? []
  }
}
