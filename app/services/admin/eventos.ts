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

export interface CriarEventoAdminInput {
  nome: string
  slug: string
  descricao?: string | null
  imagemUrl?: string | null
  inicioEm: string
  local: string
  endereco: string
  capacidadeTotal: number
  estoqueAntecipado: number
  publicacaoStatus: PublicationStatus
  vendasStatus: SalesStatus
}

export interface CriarEventoAdminResult {
  eventoId: string
  slug: string
  nome: string
  status: EventStatus
  publicacaoStatus: PublicationStatus
}

interface CriarEventoRpc {
  evento_id: string
  slug: string
  nome: string
  status: string
  publicacao_status: string
}

interface RpcErrorLike {
  code?: string | null
  message?: string | null
}

/** Cria um evento real (RPC segura, ADMINISTRADOR). Sem INSERT direto. */
export async function criarEventoAdmin(
  input: CriarEventoAdminInput
): Promise<CriarEventoAdminResult> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('criar_evento_admin', {
    p_nome: input.nome,
    p_slug: input.slug,
    p_descricao: input.descricao ?? null,
    p_imagem_url: input.imagemUrl ?? null,
    p_inicio_em: input.inicioEm,
    p_local: input.local,
    p_endereco: input.endereco,
    p_capacidade_total: input.capacidadeTotal,
    p_estoque_antecipado: input.estoqueAntecipado,
    p_publicacao_status: input.publicacaoStatus,
    p_vendas_status: input.vendasStatus
  })

  if (error) {
    const e = error as RpcErrorLike
    const mensagem = (e.message ?? '').toLowerCase()
    if (e.code === '42501' || mensagem.includes('permiss')) {
      throw new Error('Você não tem permissão para criar eventos.')
    }
    if (e.code === '23505' || mensagem.includes('endereco de url')) {
      throw new Error('Já existe um evento com esse endereço de URL.')
    }
    if (e.code === '23514') {
      throw new Error('Verifique os dados informados.')
    }
    throw new Error('Não foi possível criar o evento.')
  }

  const r = data as CriarEventoRpc
  return {
    eventoId: r.evento_id,
    slug: r.slug,
    nome: r.nome,
    status: r.status as EventStatus,
    publicacaoStatus: r.publicacao_status as PublicationStatus
  }
}
