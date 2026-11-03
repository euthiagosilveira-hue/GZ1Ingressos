import type {
  Produtor,
  ProdutorInput,
  SociedadeEvento,
  SociedadeTotais
} from '~/types/sociedade'

interface RpcErrorLike {
  code?: string
  message?: string
}

interface ProdutorRow {
  produtor_id: string
  nome: string
  documento: string | null
  telefone: string | null
  email: string | null
  ativo: boolean
  tem_login: boolean
  mp_conectado?: boolean
  eventos_count?: number
}

interface SociedadeRow {
  evento_id: string
  ativa: boolean
  produtor?: ProdutorRow | null
  percentual_galeria?: number | string
  percentual_produtor?: number | string
  totais?: Record<string, number | string> | null
}

function mensagemErro(error: RpcErrorLike | null, padrao: string): string {
  const mensagem = (error?.message ?? '').toLowerCase()
  if (error?.code === '42501' || mensagem.includes('permiss')) {
    return 'Você não tem permissão para gerenciar sociedades.'
  }
  if (mensagem.includes('nome do produtor')) return 'Informe o nome do produtor.'
  if (mensagem.includes('e-mail do produtor')) return 'E-mail do produtor inválido.'
  if (mensagem.includes('percentual')) return 'A porcentagem da galeria deve ser de 0 a 100.'
  if (mensagem.includes('inativo')) return 'Produtor não encontrado ou inativo.'
  if (mensagem.includes('nao encontrado')) return 'Registro não encontrado.'
  return padrao
}

function mapearProdutor(row: ProdutorRow): Produtor {
  return {
    produtorId: row.produtor_id,
    nome: row.nome,
    documento: row.documento ?? null,
    telefone: row.telefone ?? null,
    email: row.email ?? null,
    ativo: Boolean(row.ativo),
    temLogin: Boolean(row.tem_login),
    mpConectado: Boolean(row.mp_conectado),
    eventosCount: row.eventos_count
  }
}

function numero(valor: unknown): number {
  const n = Number(valor ?? 0)
  return Number.isFinite(n) ? n : 0
}

function mapearTotais(t: Record<string, number | string>): SociedadeTotais {
  return {
    pedidosPagos: numero(t.pedidos_pagos),
    online: numero(t.online),
    portaria: numero(t.portaria),
    total: numero(t.total),
    galeria: numero(t.galeria),
    produtor: numero(t.produtor),
    galeriaOnline: numero(t.galeria_online),
    produtorOnline: numero(t.produtor_online),
    galeriaPortaria: numero(t.galeria_portaria),
    produtorPortaria: numero(t.produtor_portaria)
  }
}

export function mapearSociedade(row: SociedadeRow): SociedadeEvento {
  return {
    eventoId: row.evento_id,
    ativa: Boolean(row.ativa),
    produtor: row.produtor ? mapearProdutor(row.produtor) : null,
    percentualGaleria: numero(row.percentual_galeria),
    percentualProdutor: numero(row.percentual_produtor),
    totais: row.totais ? mapearTotais(row.totais) : null
  }
}

/** Produtores cadastrados (RPC segura, ADMINISTRADOR). */
export async function listarProdutoresAdmin(): Promise<Produtor[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_produtores_admin')
  if (error) throw new Error(mensagemErro(error, 'Não foi possível carregar os produtores.'))
  return ((data as ProdutorRow[] | null) ?? []).map(mapearProdutor)
}

/** Cria (sem id) ou atualiza um produtor (RPC segura, ADMINISTRADOR, auditada). */
export async function salvarProdutorAdmin(input: ProdutorInput): Promise<Produtor> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('salvar_produtor_admin', {
    p_produtor_id: input.produtorId ?? null,
    p_nome: input.nome,
    p_documento: input.documento ?? null,
    p_telefone: input.telefone ?? null,
    p_email: input.email ?? null
  })
  if (error) throw new Error(mensagemErro(error, 'Não foi possível salvar o produtor.'))
  return mapearProdutor(data as ProdutorRow)
}

/** Sociedade do evento + divisao dos valores aprovados (RPC segura, ADMINISTRADOR). */
export async function obterSociedadeEventoAdmin(eventoId: string): Promise<SociedadeEvento> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('obter_sociedade_evento_admin', {
    p_evento_id: eventoId
  })
  if (error) throw new Error(mensagemErro(error, 'Não foi possível carregar a sociedade do evento.'))
  return mapearSociedade(data as SociedadeRow)
}

/**
 * Define a sociedade do evento (produtor + % da galeria) ou desfaz
 * (produtorId null). RPC segura, ADMINISTRADOR, auditada.
 */
export async function definirSociedadeEventoAdmin(
  eventoId: string,
  produtorId: string | null,
  percentualGaleria: number | null
): Promise<void> {
  const client = useSupabaseClient()
  const { error } = await client.rpc('definir_sociedade_evento_admin', {
    p_evento_id: eventoId,
    p_produtor_id: produtorId,
    p_percentual_galeria: produtorId ? percentualGaleria : null
  })
  if (error) throw new Error(mensagemErro(error, 'Não foi possível salvar a sociedade.'))
}

interface ErroFetch {
  data?: { error?: string; message?: string }
  status?: number
  statusCode?: number
}

/**
 * Cria o login do produtor e envia o convite por e-mail (ADMINISTRADOR).
 * O produtor passa a ver somente os eventos em sociedade dele.
 */
export async function criarAcessoProdutorAdmin(produtorId: string): Promise<void> {
  try {
    const resposta = await $fetch<{ ok?: boolean; error?: string; message?: string }>(
      `/api/admin/produtores/${encodeURIComponent(produtorId)}/acesso`,
      { method: 'POST' }
    )
    if (!resposta?.ok) throw new Error(resposta?.message ?? 'Não foi possível enviar o convite.')
  } catch (e) {
    const erro = e as ErroFetch & Error
    if (erro instanceof Error && !erro.data && !erro.status && !erro.statusCode) throw erro
    throw new Error(erro.data?.message ?? 'Não foi possível enviar o convite.')
  }
}
