// Leitura de comprovantes com IA (Google Gemini).
// Funcoes puras: montam o pedido e interpretam a resposta. A chamada HTTP
// fica em server/api/admin/financeiro/ler-comprovante.post.ts.

export type CategoriaParaIa = { id: string; nome: string }

export type LeituraComprovante = {
  /** Valor total pago, em reais (null = nao achou). */
  valor: number | null
  /** Data do pagamento em AAAA-MM-DD (null = nao achou). */
  data: string | null
  /** Descricao curta sugerida (ex.: "CEMIG - conta de luz de outubro"). */
  descricao: string | null
  /** Categoria sugerida, sempre uma das enviadas (null = nenhuma serve). */
  categoriaId: string | null
}

export const MODELO_GEMINI_PADRAO = 'gemini-3.5-flash'
export const MODELO_GEMINI_RESERVA = 'gemini-3.1-flash-lite'

export const TIPOS_ARQUIVO_LEITURA = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']

export function urlGemini(modelo: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`
}

export function promptComprovante(
  tipo: 'ENTRADA' | 'SAIDA',
  categorias: CategoriaParaIa[],
  hoje: string
): string {
  const lista = categorias.map((c) => `- ${c.nome}`).join('\n')
  const movimento = tipo === 'SAIDA' ? 'um pagamento feito pela galeria (saída de dinheiro)' : 'um dinheiro recebido pela galeria (entrada)'
  return [
    'Você lê comprovantes brasileiros (Pix, boleto, nota fiscal, cupom, recibo, transferência) de uma casa de shows chamada Galeria Zero 1.',
    `Este comprovante é de ${movimento}. Hoje é ${hoje}.`,
    'Extraia:',
    '- valor: o valor total efetivamente pago, em reais, como número (ex.: 1234.56). Não use subtotais, troco ou saldo.',
    '- data: a data do pagamento no formato AAAA-MM-DD. Se só houver vencimento, use o vencimento.',
    '- descricao: uma frase curta em português dizendo quem recebeu e o quê (ex.: "CEMIG - conta de luz de outubro", "Pix para João - cachê da banda"). Máximo 80 caracteres.',
    '- categoria: o nome EXATO de uma destas categorias, a que melhor combina, ou vazio se nenhuma servir:',
    lista || '- (nenhuma)',
    'Se não conseguir ler algum campo com segurança, deixe-o vazio (null). Não invente.'
  ].join('\n')
}

export function corpoPedidoGemini(input: {
  base64: string
  mimeType: string
  prompt: string
}): Record<string, unknown> {
  return {
    contents: [
      {
        role: 'user',
        parts: [{ inline_data: { mime_type: input.mimeType, data: input.base64 } }, { text: input.prompt }]
      }
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          valor: { type: 'NUMBER', nullable: true },
          data: { type: 'STRING', nullable: true },
          descricao: { type: 'STRING', nullable: true },
          categoria: { type: 'STRING', nullable: true }
        }
      }
    }
  }
}

/** Texto JSON devolvido pelo Gemini (primeira parte de texto do primeiro candidato). */
export function textoRespostaGemini(resposta: unknown): string {
  const r = resposta as { candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] } }[] }
  const partes = r?.candidates?.[0]?.content?.parts ?? []
  const parte = partes.find((p) => typeof p?.text === 'string' && !p.thought)
  return typeof parte?.text === 'string' ? parte.text : ''
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function lerValor(bruto: unknown): number | null {
  let n: number
  if (typeof bruto === 'number') n = bruto
  else if (typeof bruto === 'string') {
    // Aceita "1.234,56", "1234,56", "1234.56", "R$ 50"
    let s = bruto.replace(/[^0-9.,-]/g, '')
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
    n = Number(s)
  } else return null
  if (!Number.isFinite(n) || n <= 0 || n >= 100_000_000) return null
  return Math.round(n * 100) / 100
}

function lerData(bruto: unknown, hoje: string): string | null {
  if (typeof bruto !== 'string') return null
  const s = bruto.trim()
  let ano: number, mes: number, dia: number
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) {
    ano = Number(m[1]); mes = Number(m[2]); dia = Number(m[3])
  } else {
    m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s)
    if (!m) return null
    dia = Number(m[1]); mes = Number(m[2]); ano = Number(m[3])
  }
  const d = new Date(Date.UTC(ano, mes - 1, dia))
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null
  const iso = `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  // Datas absurdas (antes de 2000 ou mais de 1 ano a frente) sao descartadas.
  const limite = `${Number(hoje.slice(0, 4)) + 1}${hoje.slice(4)}`
  if (iso < '2000-01-01' || iso > limite) return null
  return iso
}

function lerCategoria(bruto: unknown, categorias: CategoriaParaIa[]): string | null {
  if (typeof bruto !== 'string' || !bruto.trim()) return null
  const alvo = normalizar(bruto)
  const exata = categorias.find((c) => normalizar(c.nome) === alvo)
  if (exata) return exata.id
  const parcial = categorias.find((c) => {
    const nome = normalizar(c.nome)
    return nome.length >= 3 && (alvo.includes(nome) || nome.includes(alvo))
  })
  return parcial?.id ?? null
}

/** Converte o JSON do Gemini em sugestoes seguras para o formulario. */
export function interpretarLeitura(
  texto: string,
  categorias: CategoriaParaIa[],
  hoje: string
): LeituraComprovante {
  let bruto: Record<string, unknown> = {}
  try {
    const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(limpo)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) bruto = parsed as Record<string, unknown>
  } catch {
    bruto = {}
  }
  const descricao =
    typeof bruto.descricao === 'string' && bruto.descricao.trim()
      ? bruto.descricao.trim().replace(/\s+/g, ' ').slice(0, 120)
      : null
  return {
    valor: lerValor(bruto.valor),
    data: lerData(bruto.data, hoje),
    descricao,
    categoriaId: lerCategoria(bruto.categoria, categorias)
  }
}

export function leituraVazia(l: LeituraComprovante): boolean {
  return l.valor === null && l.data === null && l.descricao === null && l.categoriaId === null
}
