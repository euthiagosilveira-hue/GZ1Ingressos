import type { GateScanErroCode, RegistrarEntradaQrResult } from '~/types/gate'
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

/**
 * Registra a entrada pelo QR (unica via de mutacao de portaria).
 * Nenhuma regra de negocio e decidida no frontend: o resultado vem da RPC.
 */
export async function registrarEntradaQr(input: {
  eventoId: string
  qrToken: string
}): Promise<RegistrarEntradaQrResult> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('registrar_entrada_qr', {
    p_evento_id: input.eventoId,
    p_qr_token: input.qrToken
  })

  if (error) {
    const e = error as RpcErrorLike
    const mensagem = (e.message ?? '').toLowerCase()
    if (e.code === '42501' || mensagem.includes('permiss')) {
      throw new GateError('SEM_PERMISSAO', 'Sessão de operador de portaria necessária.')
    }
    throw new GateError('ERRO_TEMPORARIO', 'Não foi possível registrar a entrada agora.')
  }

  return mapearResultadoEntradaRpc(data as Record<string, unknown>)
}
