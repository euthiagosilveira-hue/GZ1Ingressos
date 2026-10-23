import { enviarTeste, obterAdminAtivo, pushConfigurado } from '../../services/push/push-service'

/** Dispara uma notificacao de teste para os aparelhos do admin logado. */
export default defineEventHandler(async (event) => {
  const uid = await obterAdminAtivo(event)
  if (!uid) {
    setResponseStatus(event, 403)
    return { error: 'SEM_PERMISSAO' }
  }
  if (!pushConfigurado(event)) {
    setResponseStatus(event, 503)
    return { error: 'PUSH_NAO_CONFIGURADO' }
  }

  const enviadas = await enviarTeste(event, uid)
  return { ok: true, enviadas }
})
