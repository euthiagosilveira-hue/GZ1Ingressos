import type { H3Event } from 'h3'
import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

/**
 * Garante que a requisicao vem de um ADMINISTRADOR ativo.
 * Devolve o client service role (somente backend) ou lanca 401/403.
 */
export async function exigirAdmin(event: H3Event) {
  const claims = await serverSupabaseUser(event).catch(() => null)
  const uid = claims?.sub ? String(claims.sub) : ''
  if (!uid) {
    throw createError({ statusCode: 401, statusMessage: 'NAO_AUTENTICADO' })
  }

  const admin = serverSupabaseServiceRole(event)
  const { data: usuario, error } = await admin
    .from('usuarios')
    .select('perfil,ativo')
    .eq('id', uid)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  }
  if (!usuario?.ativo || usuario.perfil !== 'ADMINISTRADOR') {
    throw createError({ statusCode: 403, statusMessage: 'SEM_PERMISSAO' })
  }

  return admin
}

/**
 * Garante que a requisicao vem da equipe (ADMINISTRADOR ou PORTARIA) ativa.
 * Devolve o client service role (somente backend) ou lanca 401/403.
 */
export async function exigirEquipe(event: H3Event) {
  const claims = await serverSupabaseUser(event).catch(() => null)
  const uid = claims?.sub ? String(claims.sub) : ''
  if (!uid) {
    throw createError({ statusCode: 401, statusMessage: 'NAO_AUTENTICADO' })
  }

  const admin = serverSupabaseServiceRole(event)
  const { data: usuario, error } = await admin
    .from('usuarios')
    .select('perfil,ativo')
    .eq('id', uid)
    .maybeSingle()

  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  }
  if (!usuario?.ativo || (usuario.perfil !== 'ADMINISTRADOR' && usuario.perfil !== 'PORTARIA')) {
    throw createError({ statusCode: 403, statusMessage: 'SEM_PERMISSAO' })
  }

  return admin
}

/** Le e valida o parametro de rota :id (uuid do ingresso). */
export function lerIngressoIdDaRota(event: H3Event): string {
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'DADOS_INVALIDOS' })
  }
  return id
}

/**
 * Garante que a requisicao vem de um PRODUTOR ativo ligado ao evento
 * (public.eventos_sociedade). Devolve o client service role ou lanca 401/403/404.
 * Evento de outro produtor responde 404, para nao revelar que existe.
 */
export async function exigirProdutorDoEvento(event: H3Event, eventoId: string) {
  const claims = await serverSupabaseUser(event).catch(() => null)
  const uid = claims?.sub ? String(claims.sub) : ''
  if (!uid) {
    throw createError({ statusCode: 401, statusMessage: 'NAO_AUTENTICADO' })
  }

  const admin = serverSupabaseServiceRole(event)
  const { data: usuario, error } = await admin
    .from('usuarios')
    .select('perfil,ativo')
    .eq('id', uid)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  if (!usuario?.ativo || usuario.perfil !== 'PRODUTOR') {
    throw createError({ statusCode: 403, statusMessage: 'SEM_PERMISSAO' })
  }

  const { data: produtor, error: erroProdutor } = await admin
    .from('produtores')
    .select('id')
    .eq('usuario_id', uid)
    .eq('ativo', true)
    .maybeSingle()
  if (erroProdutor) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  if (!produtor) throw createError({ statusCode: 403, statusMessage: 'SEM_PERMISSAO' })

  const { data: vinculo, error: erroVinculo } = await admin
    .from('eventos_sociedade')
    .select('evento_id')
    .eq('evento_id', eventoId)
    .eq('produtor_id', produtor.id)
    .maybeSingle()
  if (erroVinculo) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  if (!vinculo) throw createError({ statusCode: 404, statusMessage: 'NAO_ENCONTRADO' })

  return admin
}
