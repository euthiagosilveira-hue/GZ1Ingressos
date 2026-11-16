import { test } from 'node:test'
import assert from 'node:assert/strict'

import { casarItemCompra, mapearPedidoReposicao, mensagemErroBaixaReposicao } from '../app/utils/reposicao.ts'
import type { ProdutoReposicao } from '../app/types/reposicao.ts'

function prod(id: string, nome: string, ativo = true): ProdutoReposicao {
  return {
    id,
    nome,
    unidade: 'fardo',
    unidadesPorEmbalagem: 12,
    unidadeAvulsa: 'unidade',
    fornecedor: null,
    ultimoPreco: null,
    quantidadeIdeal: 0,
    ativo
  }
}

const produtos = [
  prod('hln', 'LONG NECK HEINEKEN 330ML FD/24'),
  prod('hlz', 'LONG NECK HEINEKEN ZERO 330ML FD/24'),
  prod('hla', 'HEINEKEN 350ML FD/ 12UNID.'),
  prod('bra', 'BRAHMA 350ML FD/ 18UNID.'),
  prod('cor', 'LONG NECK CORONA EXTRA 330ML FD/24'),
  prod('acg', 'AGUA CRYSTAL C/G 500'),
  prod('asg', 'AGUA CRYSTAL S/ GAS 500ML FD/12UNID.'),
  prod('mon', 'MONSTER GREEN ZERO 473ML FD/6UNID.')
]
const nomes = [
  { nome: 'LONG NECK HEINEKEN 330ML FD/24', produtoId: 'hln' },
  { nome: 'AGUA CRYSTAL S/ GAS 500ML FD/12UNID.', produtoId: 'asg' },
  { nome: 'SACOLA PLASTICA', produtoId: null }
]

test('nome lembrado da nota vem primeiro', () => {
  assert.deepEqual(casarItemCompra('long neck heineken 330ml  FD/24', nomes, produtos), { produtoId: 'hln', origem: 'lembrado' })
  assert.deepEqual(casarItemCompra('AGUA CRYSTAL S/ GAS 500ML FD/12UNID.', nomes, produtos), {
    produtoId: 'asg',
    origem: 'lembrado'
  })
})

test('nome marcado como "nao e da reposicao" nao sugere produto', () => {
  assert.deepEqual(casarItemCompra('SACOLA PLASTICA', nomes, produtos), { produtoId: null, origem: 'ignorado' })
})

test('nome igual ao do produto', () => {
  assert.deepEqual(casarItemCompra('HEINEKEN 350ML FD/ 12UNID.', [], produtos), { produtoId: 'hla', origem: 'mesmo-nome' })
})

test('nome lido diferente pela IA cai no mais parecido (para conferir)', () => {
  assert.deepEqual(casarItemCompra('BRAHMAO 350ML FD/ 18UNID.', [], produtos), { produtoId: 'bra', origem: 'parecido' })
  assert.equal(casarItemCompra('MONSTER GREEN ZERO 473ML FD/', [], produtos).produtoId, 'mon')
})

test('sem nada parecido', () => {
  assert.deepEqual(casarItemCompra('CARVAO 5KG', [], produtos), { produtoId: null, origem: 'nenhum' })
})

test('produto lembrado que foi excluido nao quebra', () => {
  const r = casarItemCompra('LONG NECK HEINEKEN 330ML FD/24', nomes, produtos.filter((p) => p.id !== 'hln'))
  assert.notEqual(r.produtoId, 'hln')
})

test('pedido traz a quantidade comprada', () => {
  const p = mapearPedidoReposicao({
    id: 'p',
    status: 'ABERTO',
    itens: [
      { id: 'a', nome: 'X', quantidade: 12, quantidade_comprada: 10 },
      { id: 'b', nome: 'Y', quantidade: 3, quantidade_comprada: null }
    ]
  })
  assert.equal(p.itens[0]!.quantidadeComprada, 10)
  assert.equal(p.itens[1]!.quantidadeComprada, null)
})

test('mensagens de erro da baixa', () => {
  assert.match(mensagemErroBaixaReposicao({ message: 'Nenhum pedido da semana aberto' }), /Abra o pedido/)
  assert.match(mensagemErroBaixaReposicao({ message: 'Could not find the function public.dar_baixa_reposicao_compra_admin' }), /falta rodar o SQL/)
})
