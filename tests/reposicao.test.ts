import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  agruparPorFornecedor,
  descreverEmbalagem,
  detectarEmbalagemPeloNome,
  estoqueTotal,
  unidadesComEmbalagens,
  faltaPedir,
  lerQuantidade,
  mapearPedidoReposicao,
  mensagemErroReposicao,
  mensagemPedido,
  mesmoNome,
  quantidadeParaTexto,
  sugerirQuantidade,
  totalEstimado,
  unidadeComPlural
} from '../app/utils/reposicao.ts'
import type { ItemPedidoReposicao } from '../app/types/reposicao.ts'

function item(p: Partial<ItemPedidoReposicao>): ItemPedidoReposicao {
  return {
    id: p.nome ?? 'x',
    produtoId: null,
    nome: 'x',
    unidade: 'unidade',
    unidadesPorEmbalagem: 1,
    unidadeAvulsa: 'unidade',
    fornecedor: null,
    preco: null,
    quantidadeIdeal: 0,
    estoqueAtual: null,
    estoqueFechados: null,
    estoqueSoltos: null,
    quantidade: 0,
    pedidoFeito: false,
    pedidoFeitoEm: null,
    ...p
  }
}

test('sugerirQuantidade: ideal menos o que tem, para cima, nunca negativo', () => {
  assert.equal(sugerirQuantidade(10, 3), 7)
  assert.equal(sugerirQuantidade(10, 2.5), 8)
  assert.equal(sugerirQuantidade(10, 12), 0)
  assert.equal(sugerirQuantidade(10, null), 0)
  assert.equal(sugerirQuantidade(0.3, 0.1), 1)
})

test('lerQuantidade aceita virgula e ponto, rejeita negativo/texto', () => {
  assert.equal(lerQuantidade('2'), 2)
  assert.equal(lerQuantidade('1,5'), 1.5)
  assert.equal(lerQuantidade(' 3.25 '), 3.25)
  assert.equal(lerQuantidade(''), null)
  assert.ok(Number.isNaN(lerQuantidade('-1')))
  assert.ok(Number.isNaN(lerQuantidade('abc')))
  assert.equal(quantidadeParaTexto(1.5), '1,5')
  assert.equal(quantidadeParaTexto(null), '')
})

test('total, falta pedir e agrupamento por fornecedor', () => {
  const itens = [
    item({ nome: 'Skol', fornecedor: 'Ambev', preco: 38.5, quantidade: 2, pedidoFeito: true }),
    item({ nome: 'Gelo', preco: 8, quantidade: 3 }),
    item({ nome: 'Água', fornecedor: 'ambev', preco: 12, quantidade: 0 }),
    item({ nome: 'Copo', fornecedor: 'Atacadão', quantidade: 1 })
  ]
  assert.equal(totalEstimado(itens), 101)
  assert.deepEqual(faltaPedir(itens).map((i) => i.nome), ['Gelo', 'Copo'])
  const grupos = agruparPorFornecedor(itens)
  assert.deepEqual(grupos.map((g) => g.fornecedor), ['Ambev', 'Atacadão', null])
  assert.deepEqual(grupos[0]!.itens.map((i) => i.nome), ['Água', 'Skol'])
})

test('mensagemPedido: so itens com quantidade, sem precos', () => {
  const itens = [
    item({ nome: 'Skol lata', fornecedor: 'Ambev', unidade: 'fardo', preco: 38.5, quantidade: 2 }),
    item({ nome: 'Água', fornecedor: 'Ambev', unidade: 'fardo', quantidade: 0 }),
    item({ nome: 'Gelo', unidade: 'saco', quantidade: 1 })
  ]
  const porFornecedor = mensagemPedido(itens.slice(0, 2), { fornecedor: 'Ambev', data: '15/11/2026' })
  assert.match(porFornecedor, /Galeria Zero 1 \(15\/11\/2026\)/)
  assert.match(porFornecedor, /• 2 fardos - Skol lata/)
  assert.doesNotMatch(porFornecedor, /Água|38/)
  const completo = mensagemPedido(itens)
  assert.match(completo, /\*Ambev\*[\s\S]*\*Sem fornecedor\*[\s\S]*• 1 saco - Gelo/)
})

test('plural da unidade e nomes iguais', () => {
  assert.equal(unidadeComPlural('fardo', 2), 'fardos')
  assert.equal(unidadeComPlural('fardo', 1), 'fardo')
  assert.equal(unidadeComPlural('galão', 3), 'galões')
  assert.equal(unidadeComPlural('kg', 3), 'kg')
  assert.equal(unidadeComPlural('litro', 3), 'litros')
  assert.ok(mesmoNome('Água  Mineral', 'agua mineral'))
  assert.ok(!mesmoNome('Água', 'Gelo'))
})

test('mapearPedidoReposicao converte numeros e erros amigaveis', () => {
  const p = mapearPedidoReposicao({
    id: 'p1',
    status: 'ABERTO',
    criado_em: '2026-11-15T10:00:00Z',
    finalizado_em: null,
    itens: [{ id: 'i1', nome: 'Gelo', unidade: 'saco', preco: '8.00', quantidade_ideal: '20.000', estoque_atual: null, quantidade: '15.000', pedido_feito: true }]
  })
  assert.equal(p.itens[0]!.preco, 8)
  assert.equal(p.itens[0]!.quantidade, 15)
  assert.equal(p.itens[0]!.estoqueAtual, null)
  assert.equal(p.itens[0]!.pedidoFeito, true)
  assert.equal(mensagemErroReposicao({ message: 'Ja existe um produto com esse nome' }), 'Já existe um produto com esse nome.')
})

test('embalagem: sugere em embalagens fechadas a partir de unidades', () => {
  // Ideal 120 latas, tem 30, fardo de 12 -> faltam 90 = 7,5 -> 8 fardos
  assert.equal(sugerirQuantidade(120, 30, 12), 8)
  assert.equal(sugerirQuantidade(120, 120, 12), 0)
  assert.equal(sugerirQuantidade(120, 108, 12), 1)
  assert.equal(sugerirQuantidade(10, 3), 7)
  // 2 fardos fechados + 6 soltas = 30 latas
  assert.equal(estoqueTotal(2, 6, 12), 30)
  assert.equal(estoqueTotal(null, 6, 12), 6)
  assert.equal(estoqueTotal(2, null, 12), 24)
  assert.equal(estoqueTotal(null, null, 12), null)
})

test('embalagem: textos e mensagem para o fornecedor', () => {
  const skol = { unidade: 'fardo', unidadesPorEmbalagem: 12, unidadeAvulsa: 'lata' }
  assert.equal(descreverEmbalagem(skol), 'fardo c/ 12 latas')
  assert.equal(descreverEmbalagem({ unidade: 'unidade', unidadesPorEmbalagem: 1, unidadeAvulsa: 'unidade' }), 'unidade')
  assert.equal(unidadesComEmbalagens(120, skol), '120 latas (10 fardos)')
  assert.equal(unidadesComEmbalagens(30, skol), '30 latas (2,5 fardos)')
  const msg = mensagemPedido([item({ nome: 'Skol lata', fornecedor: 'Ambev', ...skol, quantidade: 8 })], { fornecedor: 'Ambev' })
  assert.match(msg, /• 8 fardos \(12 un\.\) - Skol lata/)
  assert.equal(totalEstimado([item({ ...skol, preco: 38.5, quantidade: 8 })]), 308)
})

test('detectarEmbalagemPeloNome le FD/12, FD 24 UNID e C/144', () => {
  assert.deepEqual(detectarEmbalagemPeloNome('AGUA CRYSTAL S/ GAS 500ML FD/12UNID.'), { unidade: 'fardo', unidadesPorEmbalagem: 12 })
  assert.deepEqual(detectarEmbalagemPeloNome('LONG NECK AMSTEL ULTRA 330ML FD 24 UNID.'), { unidade: 'fardo', unidadesPorEmbalagem: 24 })
  assert.deepEqual(detectarEmbalagemPeloNome('KETCHUP 7G C/144'), { unidade: 'caixa', unidadesPorEmbalagem: 144 })
  assert.equal(detectarEmbalagemPeloNome('AGUA CRYSTAL C/G 500'), null)
  assert.equal(detectarEmbalagemPeloNome('BACON SEARA PORCIONA'), null)
})
