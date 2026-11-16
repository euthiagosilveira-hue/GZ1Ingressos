import { exigirAdmin } from '../../../utils/admin-auth'
import { baixarComprovante, chamarGemini, chaveGemini, hojeSaoPaulo } from '../../../utils/gemini'
import { corpoPedidoGemini } from '../../../utils/leitura-comprovante'
import { SCHEMA_VENCIMENTO, interpretarVencimento, promptVencimento } from '../../../utils/leitura-vencimento'

// Le a foto/PDF de uma conta (boleto, fatura) e devolve o dia do vencimento,
// para preencher o "vence todo dia" da conta fixa. Nada e salvo aqui.

export default defineEventHandler(async (event) => {
  const admin = await exigirAdmin(event)
  const chave = chaveGemini(event)

  const body = (await readBody(event).catch(() => ({}))) as { caminho?: unknown }
  const { base64, mimeType } = await baixarComprovante(admin, body?.caminho)

  const pedido = corpoPedidoGemini({ base64, mimeType, prompt: promptVencimento(hojeSaoPaulo()), schema: SCHEMA_VENCIMENTO })
  const { texto, modelo } = await chamarGemini(event, chave, pedido, 'ler-vencimento')

  const leitura = interpretarVencimento(texto)
  if (!leitura) throw createError({ statusCode: 422, statusMessage: 'NAO_LEU' })
  return { ...leitura, modelo }
})
