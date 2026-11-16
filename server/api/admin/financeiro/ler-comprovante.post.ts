import { exigirAdmin } from '../../../utils/admin-auth'
import { baixarComprovante, chamarGemini, chaveGemini, hojeSaoPaulo } from '../../../utils/gemini'
import {
  type CategoriaParaIa,
  corpoPedidoGemini,
  interpretarLeitura,
  leituraVazia,
  promptComprovante
} from '../../../utils/leitura-comprovante'

// Le o comprovante ja enviado ao bucket privado e sugere valor, data,
// descricao e categoria usando o Google Gemini. Nada e salvo aqui: o
// formulario so e preenchido, e a pessoa confere antes de lancar.

export default defineEventHandler(async (event) => {
  const admin = await exigirAdmin(event)
  const chave = chaveGemini(event)

  const body = (await readBody(event).catch(() => ({}))) as { caminho?: unknown; tipo?: unknown }
  const tipo = body?.tipo === 'ENTRADA' ? 'ENTRADA' : 'SAIDA'
  const { base64, mimeType } = await baixarComprovante(admin, body?.caminho)

  const { data: linhas, error: erroCategorias } = await admin
    .from('financeiro_categorias')
    .select('id,nome,tipo,ativa,chave_sistema')
    .eq('tipo', tipo)
    .eq('ativa', true)
  if (erroCategorias) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  type Linha = { id: unknown; nome: unknown; chave_sistema: unknown }
  const categorias: CategoriaParaIa[] = ((linhas ?? []) as Linha[])
    .filter((c) => c.chave_sistema !== 'INGRESSOS' && c.chave_sistema !== 'REEMBOLSO_INGRESSO')
    .map((c) => ({ id: String(c.id), nome: String(c.nome) }))

  const hoje = hojeSaoPaulo()
  const pedido = corpoPedidoGemini({ base64, mimeType, prompt: promptComprovante(tipo, categorias, hoje) })
  const { texto, modelo } = await chamarGemini(event, chave, pedido, 'ler-comprovante')

  const leitura = interpretarLeitura(texto, categorias, hoje)
  if (leituraVazia(leitura)) throw createError({ statusCode: 422, statusMessage: 'NAO_LEU' })
  return { ...leitura, modelo }
})
