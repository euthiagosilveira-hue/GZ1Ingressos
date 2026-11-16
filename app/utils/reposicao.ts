import type {
  ConsumoBar,
  GrupoFornecedor,
  ItemPedidoReposicao,
  PedidoReposicao,
  PreviaRelatorioBar,
  ProdutoReposicao,
  ProdutoVendaBar,
  VendaBar,
  VinculoBar
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

function porEmbalagem(v: unknown): number {
  const n = numOuNull(v)
  return n !== null && n > 0 ? n : 1
}

export function mapearProdutoReposicao(r: Bruto): ProdutoReposicao {
  return {
    id: String(r.id),
    nome: String(r.nome ?? ''),
    unidade: String(r.unidade ?? 'unidade'),
    unidadesPorEmbalagem: porEmbalagem(r.unidades_por_embalagem),
    unidadeAvulsa: textoOuNull(r.unidade_avulsa) ?? 'unidade',
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
    unidadesPorEmbalagem: porEmbalagem(r.unidades_por_embalagem),
    unidadeAvulsa: textoOuNull(r.unidade_avulsa) ?? 'unidade',
    fornecedor: textoOuNull(r.fornecedor),
    preco: numOuNull(r.preco),
    quantidadeIdeal: numOuNull(r.quantidade_ideal) ?? 0,
    estoqueAtual: numOuNull(r.estoque_atual),
    estoqueFechados: numOuNull(r.estoque_fechados),
    estoqueSoltos: numOuNull(r.estoque_soltos),
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

/** Quantidade ideal sugerida pelo consumo: media semanal + 20% de folga, para cima. */
export function idealPeloConsumo(mediaSemanal: number): number {
  if (!(mediaSemanal > 0)) return 0
  return Math.ceil(Math.round(mediaSemanal * 1.2 * 1000) / 1000)
}

/**
 * Quantas EMBALAGENS pedir: (ideal - o que tem hoje), ambos em unidades soltas,
 * dividido pelas unidades da embalagem e arredondado para cima. Nunca negativo.
 */
export function sugerirQuantidade(ideal: number, estoqueAtual: number | null, unidadesPorEmbalagem = 1): number {
  if (estoqueAtual === null) return 0
  const falta = ideal - estoqueAtual
  if (falta <= 0) return 0
  const por = unidadesPorEmbalagem > 0 ? unidadesPorEmbalagem : 1
  return Math.ceil(Math.round((falta / por) * 1000) / 1000)
}

/** Total em unidades soltas a partir de embalagens fechadas + soltas (null se nada foi digitado). */
export function estoqueTotal(fechados: number | null, soltos: number | null, unidadesPorEmbalagem = 1): number | null {
  if (fechados === null && soltos === null) return null
  return Math.round(((fechados ?? 0) * unidadesPorEmbalagem + (soltos ?? 0)) * 1000) / 1000
}

/** Nome da embalagem; "unidade" com mais de 1 dentro vira "embalagem". */
export function nomeEmbalagem(p: { unidade: string; unidadesPorEmbalagem: number }): string {
  const u = p.unidade.trim() || 'unidade'
  return p.unidadesPorEmbalagem > 1 && /^unidades?$/i.test(u) ? 'embalagem' : u
}

/** "fardo c/ 12 latas", ou so "unidade" quando compra avulsa. */
export function descreverEmbalagem(p: { unidade: string; unidadesPorEmbalagem: number; unidadeAvulsa: string }): string {
  if (p.unidadesPorEmbalagem <= 1) return p.unidade
  return `${nomeEmbalagem(p)} c/ ${quantidadeParaTexto(p.unidadesPorEmbalagem)} ${unidadeComPlural(p.unidadeAvulsa, p.unidadesPorEmbalagem)}`
}

/** Quantidade em unidades soltas com o equivalente em embalagens: "120 latas (10 fardos)". */
export function unidadesComEmbalagens(
  quantidade: number,
  p: { unidade: string; unidadesPorEmbalagem: number; unidadeAvulsa: string }
): string {
  if (p.unidadesPorEmbalagem <= 1) return `${quantidadeParaTexto(quantidade)} ${unidadeComPlural(p.unidade, quantidade)}`
  const emb = Math.round((quantidade / p.unidadesPorEmbalagem) * 10) / 10
  return `${quantidadeParaTexto(quantidade)} ${unidadeComPlural(p.unidadeAvulsa, quantidade)} (${quantidadeParaTexto(emb)} ${unidadeComPlural(nomeEmbalagem(p), emb)})`
}

/** Le "FD/12", "FD 24 UNID", "C/144" do nome: embalagem e quantas unidades vem. */
export function detectarEmbalagemPeloNome(nome: string): { unidade: string; unidadesPorEmbalagem: number } | null {
  const m =
    /(?:fd|cx|c)\s*\/\s*(\d{1,4})/i.exec(nome) ?? /(\d{1,4})\s*unid/i.exec(nome) ?? /fd\s+(\d{1,4})/i.exec(nome)
  const n = m ? Number(m[1]) : 0
  if (!(n > 1)) return null
  const caixa = /(^|[^a-z])c\s*\/\s*\d/i.test(nome) || /(^|[^a-z])cx/i.test(nome)
  return { unidade: caixa ? 'caixa' : 'fardo', unidadesPorEmbalagem: n }
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
      const tamanho = i.unidadesPorEmbalagem > 1 ? ` (${quantidadeParaTexto(i.unidadesPorEmbalagem)} un.)` : ''
      linhas.push(`• ${quantidadeParaTexto(i.quantidade)} ${unidadeComPlural(nomeEmbalagem(i), i.quantidade)}${tamanho} - ${i.nome}`)
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
  if (/Unidades por embalagem/i.test(msg)) return 'Unidades por embalagem deve ser maior que zero.'
  if (/Informe o nome/i.test(msg)) return 'Informe o nome do produto.'
  if (/schema cache|Could not find the function/i.test(msg)) return 'A reposição ainda não foi ativada no banco (falta rodar o SQL).'
  return padrao
}

// -----------------------------------------------------------------------------
// Vendas do bar
// -----------------------------------------------------------------------------

function mapearProdutoVendaBar(r: Bruto): ProdutoVendaBar {
  return {
    grupo: textoOuNull(r.grupo),
    codigo: String(r.codigo ?? ''),
    descricao: String(r.descricao ?? ''),
    quantidade: numOuNull(r.quantidade) ?? 0,
    valor: numOuNull(r.valor) ?? 0
  }
}

export function mapearPreviaRelatorioBar(r: Bruto): PreviaRelatorioBar {
  return {
    de: String(r.de ?? ''),
    ate: String(r.ate ?? ''),
    produtos: ((r.produtos ?? []) as Bruto[]).map(mapearProdutoVendaBar),
    totalValor: numOuNull(r.totalValor) ?? 0,
    totalQuantidade: numOuNull(r.totalQuantidade) ?? 0,
    grupos: ((r.grupos ?? []) as Bruto[]).map((g) => ({
      grupo: String(g.grupo ?? ''),
      quantidade: numOuNull(g.quantidade) ?? 0,
      valor: numOuNull(g.valor) ?? 0
    })),
    conferido: r.conferido === true,
    origem: textoOuNull(r.origem)
  }
}

export function mapearVendaBar(r: Bruto): VendaBar {
  return {
    id: String(r.id),
    de: String(r.periodo_de ?? ''),
    ate: String(r.periodo_ate ?? ''),
    eventoId: r.evento_id ? String(r.evento_id) : null,
    eventoNome: textoOuNull(r.evento_nome),
    totalValor: numOuNull(r.total_valor) ?? 0,
    totalQuantidade: numOuNull(r.total_quantidade) ?? 0,
    criadoEm: String(r.criado_em ?? ''),
    itens: ((r.itens ?? []) as Bruto[]).map(mapearProdutoVendaBar)
  }
}

export function mapearVinculoBar(r: Bruto): VinculoBar {
  return {
    codigo: String(r.codigo ?? ''),
    descricao: String(r.descricao ?? ''),
    grupo: textoOuNull(r.grupo),
    quantidadeTotal: numOuNull(r.quantidade_total) ?? 0,
    produtoId: r.produto_id ? String(r.produto_id) : null,
    vendasPorUnidade: numOuNull(r.vendas_por_unidade) ?? 1
  }
}

export function mapearConsumoBar(r: Bruto | null | undefined): ConsumoBar {
  const porProduto: ConsumoBar['porProduto'] = {}
  for (const p of ((r?.produtos ?? []) as Bruto[])) {
    if (!p.produto_id) continue
    porProduto[String(p.produto_id)] = {
      total: numOuNull(p.total) ?? 0,
      mediaSemanal: numOuNull(p.media_semanal) ?? 0
    }
  }
  return { semanas: numOuNull(r?.semanas) ?? 0, porProduto }
}

/** Evento da noite do relatorio: o que comecou no primeiro dia do periodo. */
export function eventoDoRelatorio<T extends { id: string; inicioEm: string }>(eventos: T[], de: string): T | null {
  const dia = (iso: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(iso)
    )
  return eventos.find((e) => dia(e.inicioEm) === de) ?? null
}

// Palavras que nao identificam o produto (tamanho, embalagem...).
const PALAVRAS_GENERICAS = new Set(['fd', 'unid', 'un', 'c', 's', 'ml', 'l', 'g', 'kg', 'cx', 'pct', 'de', 'com', 'e'])
// Lata = 350 ml; long neck = 330 ml (como aparecem nas notas de compra).
const SINONIMOS: Record<string, string[]> = { lata: ['350ml', '350'], neck: ['330ml', '330'] }

// Palavras de embalagem: contam, mas sozinhas nao bastam para ligar.
const EMBALAGEM = new Set(['lata', 'long', 'neck', 'garrafa', 'zero', 'extra'])

/** Iguais, ou uma abrevia a outra (BUDW = BUDWEISER), com 4+ letras. */
function palavraCombina(a: string, b: string): boolean {
  if (a === b) return true
  return Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))
}

function palavras(texto: string): Set<string> {
  const lista = chaveTexto(texto)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((p) => p && !PALAVRAS_GENERICAS.has(p) && !/^\d+(unid|un)?$/.test(p))
  const todas = new Set(lista)
  for (const p of lista) for (const s of SINONIMOS[p] ?? []) todas.add(s)
  return todas
}

/**
 * Sugere o produto da Reposicao para um produto do bar pelo nome (palavras
 * em comum; empate = o de nome mais curto). null quando nada combina.
 */
export function sugerirProdutoReposicao(descricaoBar: string, produtos: ProdutoReposicao[]): ProdutoReposicao | null {
  const alvo = palavras(descricaoBar)
  let melhor: { p: ProdutoReposicao; comuns: number; sobra: number } | null = null
  for (const p of produtos) {
    if (!p.ativo) continue
    const doProduto = palavras(p.nome)
    const combina = (w: string) => [...alvo].some((a) => palavraCombina(a, w))
    // Palavra igual vale 1; abreviada (BUDW = BUDWEISER) vale um pouco menos.
    let comuns = 0
    for (const w of doProduto) if (combina(w)) comuns += alvo.has(w) ? 1 : 0.8
    // Pelo menos uma palavra "de verdade" (marca, sabor) em comum.
    const forte = [...doProduto].some((w) => !EMBALAGEM.has(w) && w.length >= 3 && !/^\d/.test(w) && combina(w))
    if (!comuns || !forte) continue
    const sobra = doProduto.size - comuns
    if (!melhor || comuns > melhor.comuns || (comuns === melhor.comuns && sobra < melhor.sobra)) {
      melhor = { p, comuns, sobra }
    }
  }
  return melhor?.p ?? null
}

/**
 * Quantas vendas no bar gastam 1 UNIDADE SOLTA do produto (1 lata, 1 garrafa).
 * Quase sempre 1; so muda para dose (ex.: 1 garrafa = 16 doses). A conversao
 * para fardo/caixa usa a embalagem cadastrada no produto.
 */
export function sugerirVendasPorUnidade(_produto?: unknown): number {
  return 1
}

export function mensagemErroVendasBar(erro: unknown, padrao = 'Não foi possível concluir. Tente novamente.'): string {
  const e = (erro ?? {}) as { statusMessage?: unknown; data?: { statusMessage?: unknown }; message?: unknown }
  const codigo = String(e.data?.statusMessage ?? e.statusMessage ?? '')
  if (codigo === 'LINK_INVALIDO') return 'Esse link não parece um relatório do sistema do bar. Copie o link inteiro do relatório.'
  if (codigo === 'LINK_EXPIRADO') return 'O link do relatório não abre mais (pode ter expirado). Gere o relatório de novo ou envie o arquivo.'
  if (codigo === 'LINK_INACESSIVEL') return 'Não foi possível abrir o link agora. Tente de novo ou envie o arquivo.'
  if (codigo === 'ARQUIVO_GRANDE') return 'O arquivo é grande demais.'
  if (codigo === 'NAO_LEU') return 'Não consegui ler esse relatório. Use o relatório "Resumo de vendas" do sistema do bar.'
  const msg = typeof e.message === 'string' ? e.message : ''
  if (/Ja existe um relatorio/i.test(msg)) return 'Esse relatório (mesmo período) já foi importado. Para trocar, exclua o antigo no histórico.'
  if (/schema cache|Could not find the function/i.test(msg)) return 'As vendas do bar ainda não foram ativadas no banco (falta rodar o SQL).'
  return mensagemErroReposicao(erro, padrao)
}
