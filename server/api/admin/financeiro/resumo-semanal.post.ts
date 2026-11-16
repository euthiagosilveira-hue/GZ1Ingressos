import { gerarResumoSemanal } from '../../../services/caixa/monitor-caixa'
import { exigirAdmin } from '../../../utils/admin-auth'

// Botao "Gerar resumo agora" do Financeiro: refaz o resumo da ultima semana
// fechada e mostra na tela (sem notificacao; a de segunda continua igual).

export default defineEventHandler(async (event) => {
  const admin = await exigirAdmin(event)
  return await gerarResumoSemanal(event, admin, { enviarPush: false })
})
