import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  agruparPorFornecedor,
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
    fornecedor: null,
    preco: null,
    quantidadeIdeal: 0,
    estoqueAtual: null,
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
