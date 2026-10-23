import { serverSupabaseServiceRole } from '#supabase/server'

import { obterAdminAtivo } from '../../services/push/push-service'

/** Remove a inscricao push deste aparelho. */
export default defineEventHandler(async (event) => {
  const uid = await obterAdminAtivo(event)
  if (!uid) {
    setResponseStatus(event, 403)
    return { error: 'SEM_PERMISSAO' }
  }

  const body = await readBody<{ endpoint?: string }>(event).catch(() => ({}))
  const endpoint = String(body?.endpoint ?? '').trim()
  if (!endpoint) {
    setResponseStatus(event, 400)
    return { error: 'DADOS_INVALIDOS' }
  }

  await serverSupabaseServiceRole(event)
    .from('push_inscricoes')
    .delete()
    .eq('endpoint', endpoint)
    .eq('usuario_id', uid)

  return { ok: true }
})
