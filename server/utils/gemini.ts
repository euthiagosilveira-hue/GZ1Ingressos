import type { H3Event } from 'h3'

import {
  MODELO_GEMINI_PADRAO,
  MODELO_GEMINI_RESERVA,
  TIPOS_ARQUIVO_LEITURA,
  textoRespostaGemini,
  urlGemini
} from './leitura-comprovante'

// Chamada ao Google Gemini com o modelo configurado e, se ele falhar
// (inexistente, limite gratuito, instabilidade), o modelo reserva.
// Erros viram os mesmos codigos que a tela ja sabe explicar.

export function chaveGemini(event: H3Event): string {
  const chave = String(useRuntimeConfig(event).geminiApiKey || '')
  if (!chave) throw createError({ statusCode: 503, statusMessage: 'IA_NAO_CONFIGURADA' })
  return chave
}

export async function chamarGemini(
  event: H3Event,
  chave: string,
  pedido: Record<string, unknown>,
  rotulo: string
): Promise<{ texto: string; modelo: string }> {
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
      console.warn(`[${rotulo}] Gemini ${modelo} respondeu ${resposta.status}: ${detalhe.slice(0, 300)}`)
      if ([404, 429, 500, 503].includes(resposta.status)) continue
      break
    }
    return { texto: textoRespostaGemini(await resposta.json()), modelo }
  }

  if (ultimoStatus === 429) throw createError({ statusCode: 429, statusMessage: 'LIMITE_IA' })
  if (chaveRecusada || ultimoStatus === 401 || ultimoStatus === 403) {
    throw createError({ statusCode: 503, statusMessage: 'IA_CHAVE_INVALIDA' })
  }
  throw createError({ statusCode: 502, statusMessage: 'IA_INDISPONIVEL' })
}

/** Data de hoje em Sao Paulo (AAAA-MM-DD). */
export function hojeSaoPaulo(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

// --- Comprovante ja enviado ao bucket privado -------------------------------

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

type ClienteStorage = {
  storage: { from(bucket: string): { download(caminho: string): Promise<{ data: Blob | null; error: unknown }> } }
}

/** Baixa o comprovante do bucket e devolve em base64 com o tipo do arquivo. */
export async function baixarComprovante(
  admin: ClienteStorage,
  caminhoBruto: unknown
): Promise<{ base64: string; mimeType: string }> {
  const caminho = String(caminhoBruto ?? '').trim()
  if (!CAMINHO_VALIDO.test(caminho)) throw createError({ statusCode: 400, statusMessage: 'DADOS_INVALIDOS' })

  const { data: arquivo, error } = await admin.storage.from(BUCKET).download(caminho)
  if (error || !arquivo) throw createError({ statusCode: 404, statusMessage: 'NAO_ENCONTRADO' })

  const extensao = caminho.split('.').pop()!.toLowerCase()
  const mimeType = TIPOS_ARQUIVO_LEITURA.includes(arquivo.type) ? arquivo.type : POR_EXTENSAO[extensao]
  if (!mimeType) throw createError({ statusCode: 415, statusMessage: 'FORMATO_NAO_SUPORTADO' })
  return { base64: Buffer.from(await arquivo.arrayBuffer()).toString('base64'), mimeType }
}
