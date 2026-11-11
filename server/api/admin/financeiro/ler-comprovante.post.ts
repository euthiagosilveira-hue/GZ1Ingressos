import { exigirAdmin } from '../../../utils/admin-auth'
import {
  type CategoriaParaIa,
  MODELO_GEMINI_PADRAO,
  MODELO_GEMINI_RESERVA,
  TIPOS_ARQUIVO_LEITURA,
  corpoPedidoGemini,
  interpretarLeitura,
  leituraVazia,
  promptComprovante,
  textoRespostaGemini,
  urlGemini
} from '../../../utils/leitura-comprovante'

// Le o comprovante ja enviado ao bucket privado e sugere valor, data,
// descricao e categoria usando o Google Gemini. Nada e salvo aqui: o
// formulario so e preenchido, e a pessoa confere antes de lancar.

const BUCKET = 'financeiro-comprovantes'
const CAMINHO_VALIDO = /^\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/i
const POR_EXTENSAO: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf'
}

function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

export default defineEventHandler(async (event) => {
  const admin = await exigirAdmin(event)

  const chave = String(useRuntimeConfig(event).geminiApiKey || '')
  if (!chave) throw createError({ statusCode: 503, statusMessage: 'IA_NAO_CONFIGURADA' })

  const body = (await readBody(event).catch(() => ({}))) as { caminho?: unknown; tipo?: unknown }
  const caminho = String(body?.caminho ?? '').trim()
  const tipo = body?.tipo === 'ENTRADA' ? 'ENTRADA' : 'SAIDA'
  if (!CAMINHO_VALIDO.test(caminho)) throw createError({ statusCode: 400, statusMessage: 'DADOS_INVALIDOS' })

  const { data: arquivo, error: erroArquivo } = await admin.storage.from(BUCKET).download(caminho)
  if (erroArquivo || !arquivo) throw createError({ statusCode: 404, statusMessage: 'NAO_ENCONTRADO' })

  const extensao = caminho.split('.').pop()!.toLowerCase()
  const mimeType = TIPOS_ARQUIVO_LEITURA.includes(arquivo.type) ? arquivo.type : POR_EXTENSAO[extensao]
  if (!mimeType) throw createError({ statusCode: 415, statusMessage: 'FORMATO_NAO_SUPORTADO' })
  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64')

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

  const configurado = String(useRuntimeConfig(event).geminiModel || '').trim()
  const modelos = [...new Set([configurado || MODELO_GEMINI_PADRAO, MODELO_GEMINI_RESERVA])]

  let ultimoStatus = 0
  let chaveRecusada = false
  for (const modelo of modelos) {
    let resposta: Response
    try {
      resposta = await fetch(urlGemini(modelo), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(pedido),
        signal: AbortSignal.timeout(40_000)
      })
    } catch {
      ultimoStatus = 504
      continue
    }
    if (!resposta.ok) {
      ultimoStatus = resposta.status
      const detalhe = await resposta.text().catch(() => '')
      if (/API_KEY|PERMISSION_DENIED/i.test(detalhe)) chaveRecusada = true
      console.warn(`[ler-comprovante] Gemini ${modelo} respondeu ${resposta.status}: ${detalhe.slice(0, 300)}`)
      // Modelo inexistente, limite gratuito atingido ou instabilidade: tenta o reserva.
      if ([404, 429, 500, 503].includes(resposta.status)) continue
      break
    }
    const leitura = interpretarLeitura(textoRespostaGemini(await resposta.json()), categorias, hoje)
    if (leituraVazia(leitura)) throw createError({ statusCode: 422, statusMessage: 'NAO_LEU' })
    return { ...leitura, modelo }
  }

  if (ultimoStatus === 429) throw createError({ statusCode: 429, statusMessage: 'LIMITE_IA' })
  if (chaveRecusada || ultimoStatus === 401 || ultimoStatus === 403) {
    throw createError({ statusCode: 503, statusMessage: 'IA_CHAVE_INVALIDA' })
  }
  throw createError({ statusCode: 502, statusMessage: 'IA_INDISPONIVEL' })
})
