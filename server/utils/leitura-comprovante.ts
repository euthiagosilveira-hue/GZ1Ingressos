// Leitura de comprovantes com IA (Google Gemini).
// Funcoes puras: montam o pedido e interpretam a resposta. A chamada HTTP
// fica em server/api/admin/financeiro/ler-comprovante.post.ts.

export type CategoriaParaIa = { id: string; nome: string }

export type ItemLido = {
  descricao: string
  quantidade: number
  /** Valor total da linha (quantidade x preco), em reais. */
  valorTotal: number
}

export type LeituraComprovante = {
  /** Valor total pago, em reais (null = nao achou). */
  valor: number | null
  /** Data do pagamento em AAAA-MM-DD (null = nao achou). */
  data: string | null
  /** Descricao curta sugerida (ex.: "CEMIG - conta de luz de outubro"). */
  descricao: string | null
  /** Categoria sugerida, sempre uma das enviadas (null = nenhuma serve). */
  categoriaId: string | null
  /** Produtos do comprovante (vazio quando nao ha lista de itens). */
  itens: ItemLido[]
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
    '- itens: se o comprovante listar produtos (nota fiscal, cupom, recibo de compra), a lista de cada linha com descricao (nome do produto como está escrito), quantidade (número) e valor_total (valor da linha em reais, já multiplicado pela quantidade). Se não houver lista de produtos (ex.: Pix, boleto, conta de luz), devolva lista vazia.',
    'Se não conseguir ler algum campo com segurança, deixe-o vazio (null). Não invente.'
  ].join('\n')
}

export function corpoPedidoGemini(input: {
  base64: string
  mimeType: string
  prompt: string
  /** Formato da resposta (padrao: o do comprovante de lancamento). */
  schema?: Record<string, unknown>
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
      responseSchema: input.schema ?? {
        type: 'OBJECT',
        properties: {
          valor: { type: 'NUMBER', nullable: true },
          data: { type: 'STRING', nullable: true },
          descricao: { type: 'STRING', nullable: true },
          categoria: { type: 'STRING', nullable: true },
          itens: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                descricao: { type: 'STRING' },
                quantidade: { type: 'NUMBER', nullable: true },
                valor_total: { type: 'NUMBER', nullable: true }
              },
              required: ['descricao']
            }
          }
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

function lerNumero(bruto: unknown): number | null {
  let n: number
  if (typeof bruto === 'number') n = bruto
  else if (typeof bruto === 'string') {
    // Aceita "1.234,56", "1234,56", "1234.56", "R$ 50"
    let s = bruto.replace(/[^0-9.,-]/g, '')
    if (!/\d/.test(s)) return null
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
    n = Number(s)
  } else return null
  return Number.isFinite(n) ? n : null
}

function lerValor(bruto: unknown): number | null {
  const n = lerNumero(bruto)
  if (n === null || n <= 0 || n >= 100_000_000) return null
  return Math.round(n * 100) / 100
}

function lerItens(bruto: unknown): ItemLido[] {
  if (!Array.isArray(bruto)) return []
  const itens: ItemLido[] = []
  for (const linha of bruto.slice(0, 200)) {
    const l = (linha ?? {}) as Record<string, unknown>
    const descricao = typeof l.descricao === 'string' ? l.descricao.trim().replace(/\s+/g, ' ').slice(0, 200) : ''
    if (!descricao) continue
    const q = lerNumero(l.quantidade)
    const quantidade = q !== null && q > 0 && q < 1_000_000 ? Math.round(q * 1000) / 1000 : 1
    const v = lerNumero(l.valor_total)
    const valorTotal = v !== null && v >= 0 && v < 100_000_000 ? Math.round(v * 100) / 100 : 0
    itens.push({ descricao, quantidade, valorTotal })
  }
  return itens
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
    categoriaId: lerCategoria(bruto.categoria, categorias),
    itens: lerItens(bruto.itens)
  }
}

export function leituraVazia(l: LeituraComprovante): boolean {
  return l.valor === null && l.data === null && l.descricao === null && l.categoriaId === null && l.itens.length === 0
}

// -----------------------------------------------------------------------------
// Fechamento do caixa do bar (comprovante impresso na maquininha)
// -----------------------------------------------------------------------------

export type LeituraFechamentoBar = {
  /** Data do fechamento em AAAA-MM-DD (null = nao achou). */
  data: string | null
  /** Vendas por forma de pagamento, em reais (null = nao aparece no comprovante). */
  dinheiro: number | null
  credito: number | null
  debito: number | null
  pix: number | null
  /** Vale, voucher e outras formas que nao sao as de cima. */
  outros: number | null
  /** Total de vendas impresso no comprovante (null = nao achou). */
  total: number | null
}

export function promptFechamentoBar(hoje: string): string {
  return [
    'Você lê o comprovante de FECHAMENTO DE CAIXA do bar de uma casa de shows (Galeria Zero 1), impresso na maquininha ou no sistema do bar no fim da noite.',
    `Hoje é ${hoje}.`,
    'Extraia o total VENDIDO em cada forma de pagamento, em reais, como número (ex.: 1234.56):',
    '- dinheiro: vendas recebidas em dinheiro (espécie).',
    '- credito: vendas no cartão de crédito.',
    '- debito: vendas no cartão de débito.',
    '- pix: vendas por Pix (inclua QR Code Pix).',
    '- outros: soma de outras formas (vale, voucher, ticket alimentação etc.). Não coloque aqui crédito, débito, Pix nem dinheiro.',
    '- total: o total de vendas impresso no comprovante.',
    '- data: a data do fechamento (ou do movimento) no formato AAAA-MM-DD.',
    'Se o comprovante mostrar só "cartão" sem separar crédito e débito, coloque o valor em credito.',
    'NÃO conte como venda: troco inicial/abertura/fundo de caixa, sangria, suprimento, reforço, cancelamentos, estornos, descontos nem saldo final da gaveta. Use os valores líquidos de vendas (já sem cancelamentos), se houver.',
    'Se uma forma de pagamento não aparecer no comprovante, deixe-a vazia (null). Não invente.'
  ].join('\n')
}

export const SCHEMA_FECHAMENTO_BAR: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    data: { type: 'STRING', nullable: true },
    dinheiro: { type: 'NUMBER', nullable: true },
    credito: { type: 'NUMBER', nullable: true },
    debito: { type: 'NUMBER', nullable: true },
    pix: { type: 'NUMBER', nullable: true },
    outros: { type: 'NUMBER', nullable: true },
    total: { type: 'NUMBER', nullable: true }
  }
}

/** Valor de venda: zero e permitido (forma que nao vendeu nada). */
function lerValorVenda(bruto: unknown): number | null {
  const n = lerNumero(bruto)
  if (n === null || n < 0 || n >= 100_000_000) return null
  return Math.round(n * 100) / 100
}

export function interpretarFechamentoBar(texto: string, hoje: string): LeituraFechamentoBar {
  let bruto: Record<string, unknown> = {}
  try {
    const limpo = texto.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    const parsed = JSON.parse(limpo)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) bruto = parsed as Record<string, unknown>
  } catch {
    bruto = {}
  }
  return {
    data: lerData(bruto.data, hoje),
    dinheiro: lerValorVenda(bruto.dinheiro),
    credito: lerValorVenda(bruto.credito),
    debito: lerValorVenda(bruto.debito),
    pix: lerValorVenda(bruto.pix),
    outros: lerValorVenda(bruto.outros),
    total: lerValorVenda(bruto.total)
  }
}

/** Nenhuma forma de pagamento lida (a data sozinha nao ajuda). */
export function fechamentoVazio(l: LeituraFechamentoBar): boolean {
  return [l.dinheiro, l.credito, l.debito, l.pix, l.outros, l.total].every((v) => v === null)
}
