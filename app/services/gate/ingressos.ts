import type { GateScanErroCode, IngressoBuscaNome, RegistrarEntradaQrResult } from '~/types/gate'
import { mapearResultadoEntradaRpc } from '~/utils/gate'

interface RpcErrorLike {
  code?: string | null
  message?: string | null
}

export class GateError extends Error {
  code: GateScanErroCode

  constructor(code: GateScanErroCode, message: string) {
    super(message)
    this.name = 'GateError'
    this.code = code
  }
}

function mapearErro(error: RpcErrorLike): GateError {
  const mensagem = (error.message ?? '').toLowerCase()
  if (error.code === '42501' || mensagem.includes('permiss')) {
    return new GateError('SEM_PERMISSAO', 'Sessão de operador de portaria necessária.')
  }
  return new GateError('ERRO_TEMPORARIO', 'Não foi possível concluir a operação agora.')
}

interface IngressoRow {
  ingresso_id: string
  codigo: string
  participante_nome: string
  status: string
  utilizado_em: string | null
}

/** Busca ingressos pelo nome exato dentro de um evento (RPC segura). */
export async function buscarIngressosPorNome(input: {
  eventoId: string
  nome: string
}): Promise<IngressoBuscaNome[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('buscar_ingressos_por_nome', {
    p_evento_id: input.eventoId,
    p_nome: input.nome
  })
  if (error) throw mapearErro(error as RpcErrorLike)

  const rows = (data ?? []) as IngressoRow[]
  return rows.map((row) => ({
    ingressoId: row.ingresso_id,
    codigo: row.codigo,
    participanteNome: row.participante_nome,
    status: row.status,
    utilizadoEm: row.utilizado_em
  }))
}

/** Registra entrada pelo ingresso selecionado (RPC registrar_entrada_nome). */
export async function registrarEntradaNome(input: {
  eventoId: string
  ingressoId: string
}): Promise<RegistrarEntradaQrResult> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('registrar_entrada_nome', {
    p_evento_id: input.eventoId,
    p_ingresso_id: input.ingressoId
  })
  if (error) throw mapearErro(error as RpcErrorLike)
  return mapearResultadoEntradaRpc(data as Record<string, unknown>)
}
