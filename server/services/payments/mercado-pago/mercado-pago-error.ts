import { MercadoPagoHttpError } from './mercado-pago-client.ts'

export interface MpErroSanitizado {
  httpStatus: number | null
  code: string | null
  message: string | null
  cause: unknown
}

const CAMPOS_CAUSA = ['code', 'description', 'type', 'details', 'message', 'reason']
const LIMITE_TEXTO = 300
const LIMITE_ITENS = 10

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim()
  if (!limpo) return null
  const redigido = limpo
    .replace(/bearer\s+[A-Za-z0-9._-]+/gi, '[redigido]')
    .replace(/app_usr-?[A-Za-z0-9._-]+/gi, '[redigido]')
  return redigido.slice(0, LIMITE_TEXTO)
}

function causaSegura(valor: unknown): unknown {
  if (valor == null) return null
  if (typeof valor === 'string') return texto(valor)
  if (Array.isArray(valor)) return valor.slice(0, LIMITE_ITENS).map(causaSegura)
  if (typeof valor === 'object') {
    const origem = valor as Record<string, unknown>
    const saida: Record<string, unknown> = {}
    for (const chave of CAMPOS_CAUSA) {
      if (origem[chave] !== undefined) saida[chave] = causaSegura(origem[chave])
    }
    return Object.keys(saida).length > 0 ? saida : null
  }
  return String(valor).slice(0, LIMITE_TEXTO)
}

/**
 * Extrai apenas campos tecnicos seguros de um erro do Mercado Pago.
 * Nunca inclui Authorization, token, headers ou o corpo bruto.
 */
export function sanitizarErroMercadoPago(erro: unknown): MpErroSanitizado {
  const httpStatus = erro instanceof MercadoPagoHttpError ? erro.status : null

  const bruto =
    erro instanceof MercadoPagoHttpError || erro instanceof Error
      ? erro.message
      : typeof erro === 'string'
        ? erro
        : ''

  let json: Record<string, unknown> | null = null
  if (bruto) {
    try {
      const parsed = JSON.parse(bruto)
      if (parsed && typeof parsed === 'object') json = parsed as Record<string, unknown>
    } catch {
      json = null
    }
  }

  return {
    httpStatus,
    code: json ? texto(json.error) ?? texto(json.code) : null,
    message: json ? texto(json.message) : texto(bruto),
    cause: json ? causaSegura(json.cause ?? null) : null
  }
}
