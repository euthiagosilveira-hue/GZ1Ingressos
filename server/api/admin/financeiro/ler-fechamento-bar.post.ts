import { exigirAdmin } from '../../../utils/admin-auth'
import { baixarComprovante, chamarGemini, chaveGemini, hojeSaoPaulo } from '../../../utils/gemini'
import {
  SCHEMA_FECHAMENTO_BAR,
  corpoPedidoGemini,
  fechamentoVazio,
  interpretarFechamentoBar,
  promptFechamentoBar
} from '../../../utils/leitura-comprovante'

// Le a foto do fechamento de caixa do bar (impresso na maquininha) e devolve
// o total vendido por forma de pagamento. Nada e salvo aqui: o Fechar bar so
// e preenchido, e a pessoa confere antes de lancar.

export default defineEventHandler(async (event) => {
  const admin = await exigirAdmin(event)
  const chave = chaveGemini(event)

  const body = (await readBody(event).catch(() => ({}))) as { caminho?: unknown }
  const { base64, mimeType } = await baixarComprovante(admin, body?.caminho)

  const hoje = hojeSaoPaulo()
  const pedido = corpoPedidoGemini({
    base64,
    mimeType,
    prompt: promptFechamentoBar(hoje),
    schema: SCHEMA_FECHAMENTO_BAR
  })
  const { texto, modelo } = await chamarGemini(event, chave, pedido, 'ler-fechamento-bar')

  const leitura = interpretarFechamentoBar(texto, hoje)
  if (fechamentoVazio(leitura)) throw createError({ statusCode: 422, statusMessage: 'NAO_LEU' })
  return { ...leitura, modelo }
})
