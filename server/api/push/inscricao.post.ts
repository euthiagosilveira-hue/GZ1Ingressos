import { serverSupabaseServiceRole } from '#supabase/server'

import { validarInscricao } from '../../services/push/push-mensagem'
import { obterAdminAtivo } from '../../services/push/push-service'

/** Salva (ou atualiza) a inscricao push deste aparelho para o admin logado. */
export default defineEventHandler(async (event) => {
  const uid = await obterAdminAtivo(event)
  if (!uid) {
    setResponseStatus(event, 403)
    return { error: 'SEM_PERMISSAO' }
  }

  const inscricao = validarInscricao(await readBody(event).catch(() => null))
  if (!inscricao) {
    setResponseStatus(event, 400)
    return { error: 'DADOS_INVALIDOS' }
  }

  const userAgent = (getHeader(event, 'user-agent') ?? '').slice(0, 300) || null
  const { error } = await serverSupabaseServiceRole(event)
    .from('push_inscricoes')
    .upsert(
      { usuario_id: uid, ...inscricao, user_agent: userAgent, atualizado_em: new Date().toISOString() },
      { onConflict: 'endpoint' }
    )

  if (error) {
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }
  return { ok: true }
})
