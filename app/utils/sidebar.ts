export interface SidebarCounts {
  pedidos: number
  entradas: number
}

function inteiroNaoNegativo(valor: unknown): number | null {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero)) return null
  return Math.max(0, Math.trunc(numero))
}

/**
 * Mapeia o jsonb retornado por obter_contadores_admin. Retorna null quando a
 * fonte e invalida/incompleta, para que o badge seja oculto em vez de exibir
 * um numero incorreto.
 */
export function mapearContadoresAdmin(valor: unknown): SidebarCounts | null {
  if (!valor || typeof valor !== 'object') return null
  const origem = valor as Record<string, unknown>
  const pedidos = inteiroNaoNegativo(origem.pedidos)
  const entradas = inteiroNaoNegativo(origem.entradas)
  if (pedidos === null || entradas === null) return null
  return { pedidos, entradas }
}
