// A IA (Gemini) liga os nomes que vem nas notas de compra aos produtos da
// Reposicao: "BRAHMAO 350ML FD/ 18UNID." -> "BRAHMA 350ML FD/ 18UNID.".
// Os produtos vao numerados (P1, P2...) para a IA so escolher um numero.

export interface ProdutoParaIa {
  id: string
  nome: string
  unidade: string
  unidadesPorEmbalagem: number
}

export interface CasamentoIa {
  /** Indice do item na lista enviada. */
  item: number
  /** Produto escolhido; null = nenhum produto da reposicao. */
  produtoId: string | null
  /** Quantidade na embalagem do produto, quando a nota estiver em outra unidade. */
  quantidade: number | null
}

export const MAX_ITENS_IA = 60
export const MAX_PRODUTOS_IA = 400

export const SCHEMA_CASAMENTO = {
  type: 'OBJECT',
  properties: {
    itens: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          item: { type: 'INTEGER' },
          produto: { type: 'STRING', nullable: true },
          quantidade: { type: 'NUMBER', nullable: true }
        },
        required: ['item']
      }
    }
  },
  required: ['itens']
}

function embalagem(p: ProdutoParaIa): string {
  return p.unidadesPorEmbalagem > 1 ? `${p.unidade} com ${p.unidadesPorEmbalagem}` : p.unidade
}

export function promptCasarProdutos(
  itens: { nome: string; quantidade: number | null }[],
  produtos: ProdutoParaIa[]
): string {
  const listaProdutos = produtos.map((p, i) => `P${i + 1}: ${p.nome} [compra em ${embalagem(p)}]`).join('\n')
  const listaItens = itens
    .map((it, i) => `${i}: ${it.nome}${it.quantidade !== null ? ` (quantidade na nota: ${it.quantidade})` : ''}`)
    .join('\n')
  return [
    'Você ajuda um bar a dar baixa nas compras do estoque.',
    'Abaixo estão os PRODUTOS cadastrados no estoque e os ITENS de uma nota de compra.',
    'Para cada item da nota, diga qual produto é o mesmo (mesma marca, mesmo sabor/tipo e mesmo tamanho).',
    'Os nomes da nota vêm abreviados ou com erros de leitura (ex.: "BRAHMAO" = "BRAHMA", "REFR" = refrigerante,',
    '"C/G" = com gás, "S/ GAS" = sem gás, "LN"/"LONG" = long neck 330ml, "LT"/"LATA" = 350ml, "FD" = fardo).',
    'Cuidado com variações que são produtos diferentes: zero x normal, com gás x sem gás, lata x long neck, sabores.',
    'Se nenhum produto for o mesmo, responda produto = null. Não chute.',
    'Em "quantidade": a quantidade comprada na embalagem do produto (ex.: a nota diz 24 unidades e o produto é fardo com 12 = 2).',
    'Se a nota já estiver na mesma embalagem do produto, repita a quantidade da nota. Sem certeza, null.',
    'Responda com "produto" no formato P<número> da lista.',
    '',
    'PRODUTOS:',
    listaProdutos,
    '',
    'ITENS DA NOTA:',
    listaItens
  ].join('\n')
}

export function corpoPedidoCasamento(prompt: string): Record<string, unknown> {
  return {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA_CASAMENTO }
  }
}

/** Le a resposta da IA. Ignora itens fora da lista e produtos inexistentes. */
export function interpretarCasamento(texto: string, totalItens: number, produtos: ProdutoParaIa[]): CasamentoIa[] {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return []
  }
  const lista = (bruto as { itens?: unknown })?.itens
  if (!Array.isArray(lista)) return []
  const vistos = new Set<number>()
  const saida: CasamentoIa[] = []
  for (const r of lista as Record<string, unknown>[]) {
    const item = Number(r?.item)
    if (!Number.isInteger(item) || item < 0 || item >= totalItens || vistos.has(item)) continue
    vistos.add(item)
    const m = /^P?(\d+)$/i.exec(String(r.produto ?? '').trim())
    const produto = m ? produtos[Number(m[1]) - 1] : undefined
    const q = Number(r.quantidade)
    saida.push({
      item,
      produtoId: produto?.id ?? null,
      quantidade: produto && r.quantidade !== null && Number.isFinite(q) && q > 0 ? Math.round(q * 1000) / 1000 : null
    })
  }
  return saida.sort((a, b) => a.item - b.item)
}
