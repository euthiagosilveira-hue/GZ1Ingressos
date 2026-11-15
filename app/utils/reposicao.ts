import type {
  GrupoFornecedor,
  ItemPedidoReposicao,
  PedidoReposicao,
  ProdutoReposicao
} from '~/types/reposicao'

type Bruto = Record<string, unknown>

function numOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function textoOuNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : ''
  return s ? s : null
}

export function mapearProdutoReposicao(r: Bruto): ProdutoReposicao {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ''),
    unidade: String(r.unidade ?? 'unidade'),
    fornecedor: textoOuNull(r.fornecedor),
    ultimoPreco: numOuNull(r.ultimo_preco),
    quantidadeIdeal: numOuNull(r.quantidade_ideal) ?? 0,
    ativo: r.ativo !== false
  }
}

export function mapearItemPedidoReposicao(r: Bruto): ItemPedidoReposicao {
  return {
    id: String(r.id),
    produtoId: r.produto_id ? String(r.produto_id) : null,
    nome: String(r.nome ?? ''),
    unidade: String(r.unidade ?? 'unidade'),
    fornecedor: textoOuNull(r.fornecedor),
    preco: numOuNull(r.preco),
    quantidadeIdeal: numOuNull(r.quantidade_ideal) ?? 0,
    estoqueAtual: numOuNull(r.estoque_atual),
    quantidade: numOuNull(r.quantidade) ?? 0,
    pedidoFeito: r.pedido_feito === true,
    pedidoFeitoEm: r.pedido_feito_em ? String(r.pedido_feito_em) : null
  }
}

export function mapearPedidoReposicao(r: Bruto): PedidoReposicao {
  return {
    id: String(r.id),
    status: r.status === 'FINALIZADO' ? 'FINALIZADO' : 'ABERTO',
    criadoEm: String(r.criado_em ?? ''),
    finalizadoEm: r.finalizado_em ? String(r.finalizado_em) : null,
    itens: ((r.itens ?? []) as Bruto[]).map(mapearItemPedidoReposicao)
  }
}

/** Le uma quantidade digitada ("2", "1,5", "1.5"). Vazio = null; invalida/negativa = NaN. */
export function lerQuantidade(entrada: string | number | null | undefined): number | null {
  if (typeof entrada === 'number') return Number.isFinite(entrada) && entrada >= 0 ? entrada : Number.NaN
  const s = String(entrada ?? '').trim().replace(/\s/g, '').replace(',', '.')
  if (s === '') return null
  if (!/^\d+(\.\d+)?$/.test(s)) return Number.NaN
  return Math.round(Number(s) * 1000) / 1000
}

/** Quantidade para mostrar no campo ("1,5", "10"). */
export function quantidadeParaTexto(q: number | null): string {
  if (q === null || !Number.isFinite(q)) return ''
  return String(Number(q.toFixed(3))).replace('.', ',')
}

/** Quanto pedir: o ideal da semana menos o que tem hoje, arredondado para cima, nunca negativo. */
export function sugerirQuantidade(ideal: number, estoqueAtual: number | null): number {
  if (estoqueAtual === null) return 0
  const falta = ideal - estoqueAtual
  return falta > 0 ? Math.ceil(Math.round(falta * 1000) / 1000) : 0
}

/** Valor estimado de um item (null quando nao tem preco). */
export function valorEstimado(item: Pick<ItemPedidoReposicao, 'preco' | 'quantidade'>): number | null {
  if (item.preco === null || item.quantidade <= 0) return null
  return Math.round(item.preco * item.quantidade * 100) / 100
}

export function totalEstimado(itens: ItemPedidoReposicao[]): number {
  return Math.round(itens.reduce((t, i) => t + (valorEstimado(i) ?? 0), 0) * 100) / 100
}

/** Itens com quantidade > 0 que ainda nao foram pedidos ao fornecedor. */
export function faltaPedir(itens: ItemPedidoReposicao[]): ItemPedidoReposicao[] {
  return itens.filter((i) => i.quantidade > 0 && !i.pedidoFeito)
}

function chaveTexto(s: string | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Agrupa por fornecedor (A-Z), deixando "sem fornecedor" no fim. */
export function agruparPorFornecedor(itens: ItemPedidoReposicao[]): GrupoFornecedor[] {
  const mapa = new Map<string, GrupoFornecedor>()
  for (const item of itens) {
    const chave = chaveTexto(item.fornecedor)
    const grupo = mapa.get(chave) ?? { fornecedor: item.fornecedor, itens: [] }
    grupo.itens.push(item)
    mapa.set(chave, grupo)
  }
  return [...mapa.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'pt-BR')))
    .map(([, g]) => ({
      ...g,
      itens: [...g.itens].sort((a, b) => chaveTexto(a.nome).localeCompare(chaveTexto(b.nome), 'pt-BR'))
    }))
}

/** "fardo" -> "fardos" quando a quantidade passa de 1 (regra simples, so para a mensagem). */
export function unidadeComPlural(unidade: string, quantidade: number): string {
  const u = unidade.trim() || 'unidade'
  if (quantidade <= 1) return u
  if (/[sx]$/i.test(u)) return u
  if (/ão$/i.test(u)) return `${u.slice(0, -2)}ões`
  if (/[aeiou]$/i.test(u)) return `${u}s`
  if (/m$/i.test(u)) return `${u.slice(0, -1)}ns`
  if (/[rz]$/i.test(u)) return `${u}es`
  if (/l$/i.test(u)) return `${u.slice(0, -1)}is`
  return u
}

/** Texto do pedido para mandar ao fornecedor (sem precos). */
export function mensagemPedido(
  itens: ItemPedidoReposicao[],
  opcoes: { fornecedor?: string | null; data?: string; local?: string } = {}
): string {
  const linhas: string[] = []
  const local = opcoes.local ?? 'Galeria Zero 1'
  linhas.push(`Olá! Segue o pedido da ${local}${opcoes.data ? ` (${opcoes.data})` : ''}:`)
  linhas.push('')
  const comQuantidade = itens.filter((i) => i.quantidade > 0)
  const grupos = opcoes.fornecedor !== undefined ? [{ fornecedor: opcoes.fornecedor, itens: comQuantidade }] : agruparPorFornecedor(comQuantidade)
  grupos.forEach((g, idx) => {
    if (opcoes.fornecedor === undefined) {
      if (idx > 0) linhas.push('')
      linhas.push(`*${g.fornecedor ?? 'Sem fornecedor'}*`)
    }
    for (const i of g.itens) {
      linhas.push(`• ${quantidadeParaTexto(i.quantidade)} ${unidadeComPlural(i.unidade, i.quantidade)} - ${i.nome}`)
    }
  })
  linhas.push('')
  linhas.push('Obrigado!')
  return linhas.join('\n')
}

/** Nomes iguais ignorando maiusculas, acentos e espacos repetidos. */
export function mesmoNome(a: string, b: string): boolean {
  return chaveTexto(a).replace(/\s+/g, ' ') === chaveTexto(b).replace(/\s+/g, ' ')
}

export function mensagemErroReposicao(erro: unknown, padrao = 'Não foi possível salvar. Tente novamente.'): string {
  const msg = erro && typeof erro === 'object' && 'message' in erro ? String((erro as { message: unknown }).message) : ''
  if (/Permissao negada/i.test(msg)) return 'Só administradores podem mexer na reposição.'
  if (/Ja existe um produto/i.test(msg)) return 'Já existe um produto com esse nome.'
  if (/Cadastre os produtos/i.test(msg)) return 'Cadastre os produtos antes de montar o pedido.'
  if (/ja foi finalizado/i.test(msg)) return 'Este pedido já foi finalizado. Atualize a página.'
  if (/Informe o nome/i.test(msg)) return 'Informe o nome do produto.'
  if (/schema cache|Could not find the function/i.test(msg)) return 'A reposição ainda não foi ativada no banco (falta rodar o SQL).'
  return padrao
}
