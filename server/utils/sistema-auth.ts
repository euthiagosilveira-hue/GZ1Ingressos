import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

function mesmoSegredo(recebido: string, esperado: string): boolean {
  const a = Buffer.from(recebido)
  const b = Buffer.from(esperado)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Garante que a chamada vem do proprio banco (pg_net/pg_cron), autenticada
 * pelo segredo de private.configuracoes (Authorization: Bearer).
 * Devolve o client service role ou lanca 401.
 */
export async function exigirChamadaSistema(event: H3Event) {
  const client = serverSupabaseServiceRole(event)
  const { data: segredo, error } = await client.rpc('obter_segredo_sistema')
  const recebido = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (error || typeof segredo !== 'string' || !segredo || !mesmoSegredo(recebido, segredo)) {
    throw createError({ statusCode: 401, statusMessage: 'NAO_AUTORIZADO' })
  }
  return client
}
