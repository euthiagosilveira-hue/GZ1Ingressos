import { gerarResumoSemanal, verificarAvisosCaixa } from '../../services/caixa/monitor-caixa'
import { exigirChamadaSistema } from '../../utils/sistema-auth'

/**
 * Chamado pelo agendamento do banco (pg_cron + pg_net):
 *   AVISOS  todo dia as 10h: confere o caixa e avisa no celular o que for novo.
 *   RESUMO  toda segunda as 11h: resumo da semana escrito pela IA.
 */
export default defineEventHandler(async (event) => {
  const client = await exigirChamadaSistema(event)
  const body = await readBody<{ acao?: string }>(event).catch(() => null)
  const acao = String(body?.acao ?? '').toUpperCase()

  if (acao === 'AVISOS') return await verificarAvisosCaixa(event, client)
  if (acao === 'RESUMO') return await gerarResumoSemanal(event, client, { enviarPush: true })

  setResponseStatus(event, 400)
  return { error: 'DADOS_INVALIDOS' }
})
