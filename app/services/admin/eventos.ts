import type { AdminEventListItem, EventStatus, PublicationStatus, SalesStatus } from '~/types/evento'

export interface AdminEventFiltros {
  busca?: string | null
  status?: EventStatus | null
  publicacao?: PublicationStatus | null
  vendas?: SalesStatus | null
}

interface AdminEventRow {
  evento_id: string
  nome: string
  slug: string
  inicio_em: string
  local: string
  status: string
  vendas_status: string
  publicacao_status: string
  capacidade_total: number
  estoque_antecipado: number
  publicado_em: string | null
  lotes_count: number
  pedidos_count: number
  ingressos_count: number
}

function mapear(row: AdminEventRow): AdminEventListItem {
  return {
    eventoId: row.evento_id,
    nome: row.nome,
    slug: row.slug,
    inicioEm: row.inicio_em,
    local: row.local,
    status: row.status as EventStatus,
    vendasStatus: row.vendas_status as SalesStatus,
    publicacaoStatus: row.publicacao_status as PublicationStatus,
    capacidadeTotal: row.capacidade_total,
    estoqueAntecipado: row.estoque_antecipado,
    publicadoEm: row.publicado_em,
    lotesCount: row.lotes_count,
    pedidosCount: row.pedidos_count,
    ingressosCount: row.ingressos_count
  }
}

/** Listagem administrativa real de eventos (RPC segura, ADMINISTRADOR). */
export async function listarEventosAdmin(
  filtros: AdminEventFiltros = {}
): Promise<AdminEventListItem[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_eventos_admin_filtrado', {
    p_busca: filtros.busca?.trim() ? filtros.busca.trim() : null,
    p_status: filtros.status ?? null,
    p_publicacao: filtros.publicacao ?? null,
    p_vendas: filtros.vendas ?? null
  })
  if (error) {
    throw new Error('Não foi possível carregar os eventos.')
  }
  const rows = (data ?? []) as AdminEventRow[]
  return rows.map(mapear)
}
