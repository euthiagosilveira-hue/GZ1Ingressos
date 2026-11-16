import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  corpoPedidoCasamento,
  interpretarCasamento,
  promptCasarProdutos
} from '../server/utils/casar-produtos-ia.ts'
import { precisaDaIa } from '../app/utils/reposicao.ts'

const produtos = [
  { id: 'bra', nome: 'BRAHMA 350ML FD/ 18UNID.', unidade: 'fardo', unidadesPorEmbalagem: 18 },
  { id: 'acg', nome: 'AGUA CRYSTAL C/G 500', unidade: 'fardo', unidadesPorEmbalagem: 12 },
  { id: 'gel', nome: 'GELO', unidade: 'saco', unidadesPorEmbalagem: 1 }
]

test('prompt numera os produtos e os itens', () => {
  const p = promptCasarProdutos([{ nome: 'BRAHMAO 350ML', quantidade: 5 }, { nome: 'CARVAO', quantidade: null }], produtos)
  assert.match(p, /P1: BRAHMA 350ML FD\/ 18UNID\. \[compra em fardo com 18\]/)
  assert.match(p, /P3: GELO \[compra em saco\]/)
  assert.match(p, /0: BRAHMAO 350ML \(quantidade na nota: 5\)/)
  assert.match(p, /1: CARVAO\n?$/)
  const corpo = corpoPedidoCasamento(p) as { generationConfig: { responseMimeType: string } }
  assert.equal(corpo.generationConfig.responseMimeType, 'application/json')
})

test('le a resposta da IA', () => {
  const r = interpretarCasamento(
    JSON.stringify({
      itens: [
        { item: 1, produto: null, quantidade: 3 },
        { item: 0, produto: 'P1', quantidade: 5 },
        { item: 2, produto: 'P2', quantidade: null }
      ]
    }),
    3,
    produtos
  )
  assert.deepEqual(r, [
    { item: 0, produtoId: 'bra', quantidade: 5 },
    { item: 1, produtoId: null, quantidade: null },
    { item: 2, produtoId: 'acg', quantidade: null }
  ])
})

test('ignora lixo, itens fora da lista e produtos que nao existem', () => {
  assert.deepEqual(interpretarCasamento('nao e json', 2, produtos), [])
  assert.deepEqual(interpretarCasamento('{"x":1}', 2, produtos), [])
  const r = interpretarCasamento(
    JSON.stringify({ itens: [{ item: 9, produto: 'P1' }, { item: 0, produto: 'P99' }, { item: 0, produto: 'P2' }] }),
    2,
    produtos
  )
  assert.deepEqual(r, [{ item: 0, produtoId: null, quantidade: null }])
})

test('so pergunta para a IA o que nao foi reconhecido com certeza', () => {
  assert.equal(precisaDaIa('parecido'), true)
  assert.equal(precisaDaIa('nenhum'), true)
  assert.equal(precisaDaIa('lembrado'), false)
  assert.equal(precisaDaIa('mesmo-nome'), false)
  assert.equal(precisaDaIa('ignorado'), false)
})
