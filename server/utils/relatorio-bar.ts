// Leitura do relatorio "Resumo de vendas" do sistema do bar (Compufour).
// Funcoes puras: recebem o HTML e devolvem os produtos ja somados.

export type ProdutoRelatorioBar = {
  grupo: string | null
  codigo: string
  descricao: string
  quantidade: number
  valor: number
}

export type RelatorioBar = {
  /** Periodo do relatorio em AAAA-MM-DD. */
  de: string
  ate: string
  /** Produtos somados por codigo, do mais vendido (em R$) para o menos. */
  produtos: ProdutoRelatorioBar[]
  totalValor: number
  totalQuantidade: number
  /** Total por grupo (Bebidas, Dose...). */
  grupos: { grupo: string; quantidade: number; valor: number }[]
  /** A soma das linhas bate com o resumo por grupo do final do relatorio. */
  conferido: boolean
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

function textoCelula(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
        return Number.isFinite(n) ? String.fromCodePoint(n) : m
      }
      return ENTIDADES[e.toLowerCase()] ?? m
    })
    .replace(/\s+/g, ' ')
    .trim()
}

/** "1.196,000" -> 1196; "128,00" -> 128. null se nao for numero. */
export function numeroBr(texto: string): number | null {
  const s = texto.replace(/\s/g, '')
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(s)) return null
  const n = Number(s.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function dataIso(br: string): string {
  const [d, m, a] = br.split('/')
  return `${a}-${m}-${d}`
}

const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000

/** Tira estilos e scripts (o relatorio traz o Bootstrap inteiro embutido). */
export function enxugarHtml(html: string): string {
  return html.replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
}

/**
 * Le o relatorio. Devolve null quando o HTML nao parece o "Resumo de vendas"
 * (sem periodo ou sem nenhum produto).
 */
export function lerRelatorioBar(htmlBruto: string): RelatorioBar | null {
  const html = enxugarHtml(htmlBruto)
  const periodo = /(\d{2}\/\d{2}\/\d{4})\s*at(?:é|&eacute;|e)\s*(\d{2}\/\d{2}\/\d{4})/i.exec(html)
  if (!periodo) return null
  const de = dataIso(periodo[1]!)
  const ate = dataIso(periodo[2]!)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(de) || !/^\d{4}-\d{2}-\d{2}$/.test(ate)) return null

  const porCodigo = new Map<string, ProdutoRelatorioBar>()
  let resumoValor = 0
  let temResumo = false
  let grupo: string | null = null

  // Percorre, na ordem, os titulos "Grupo: X" e as linhas das tabelas.
  const marcador = /Grupo:\s*([^<]+)<|<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  for (const m of html.matchAll(marcador)) {
    if (m[1] !== undefined) {
      grupo = textoCelula(m[1]) || null
      continue
    }
    const celulas = [...m[2]!.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => textoCelula(c[1]!))
    if (celulas.length >= 5 && /^\d+$/.test(celulas[0]!)) {
      // Codigo | Descricao | Qtde | Custo | Preco
      const quantidade = numeroBr(celulas[2]!)
      const valor = numeroBr(celulas[4]!)
      const descricao = celulas[1]!
      if (quantidade === null || valor === null || !descricao) continue
      const codigo = celulas[0]!
      const atual = porCodigo.get(codigo)
      if (atual) {
        atual.quantidade = r3(atual.quantidade + quantidade)
        atual.valor = r2(atual.valor + valor)
      } else {
        porCodigo.set(codigo, { grupo, codigo, descricao, quantidade: r3(quantidade), valor: r2(valor) })
      }
    } else if (celulas.length === 4 && numeroBr(celulas[1]!) !== null && numeroBr(celulas[3]!) !== null) {
      // Resumo do final: Grupo | Quantidade | Custo | Preco
      resumoValor += numeroBr(celulas[3]!)!
      temResumo = true
    }
  }

  const produtos = [...porCodigo.values()].sort(
    (a, b) => b.valor - a.valor || a.descricao.localeCompare(b.descricao, 'pt-BR')
  )
  if (!produtos.length) return null

  const totalValor = r2(produtos.reduce((s, p) => s + p.valor, 0))
  const totalQuantidade = r3(produtos.reduce((s, p) => s + p.quantidade, 0))
  const porGrupo = new Map<string, { grupo: string; quantidade: number; valor: number }>()
  for (const p of produtos) {
    const g = p.grupo ?? 'Sem grupo'
    const atual = porGrupo.get(g) ?? { grupo: g, quantidade: 0, valor: 0 }
    atual.quantidade = r3(atual.quantidade + p.quantidade)
    atual.valor = r2(atual.valor + p.valor)
    porGrupo.set(g, atual)
  }

  return {
    de,
    ate,
    produtos,
    totalValor,
    totalQuantidade,
    grupos: [...porGrupo.values()].sort((a, b) => b.valor - a.valor),
    conferido: temResumo && Math.abs(r2(resumoValor) - totalValor) < 0.01
  }
}

/** Aceita so links de relatorio do sistema do bar (Compufour, na Amazon S3). */
export function linkRelatorioValido(bruto: string): URL | null {
  let url: URL
  try {
    url = new URL(bruto.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return null
  const host = url.hostname.toLowerCase()
  const virtual = /^compufour\.s3(\.[a-z0-9-]+)?\.amazonaws\.com$/.test(host)
  const caminho = /^s3(\.[a-z0-9-]+)?\.amazonaws\.com$/.test(host) && url.pathname.startsWith('/compufour/')
  if (!virtual && !caminho) return null
  if (!/\.html?$/i.test(url.pathname)) return null
  return url
}
