import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { nomePrimeiroParticipante } from '../app/utils/checkout.ts'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

const composable = ler('../app/composables/usePublicCheckout.ts')
const progresso = ler('../app/components/public/checkout/CheckoutProgress.vue')

test('A) etapas na ordem Quantidade -> Comprador -> Participantes -> Revisao', () => {
  const ordem = ['QUANTIDADE', 'COMPRADOR', 'PARTICIPANTES', 'REVISAO'].map((k) =>
    progresso.indexOf(`key: '${k}'`)
  )
  assert.ok(ordem.every((pos) => pos >= 0))
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem)
  assert.match(composable, /QUANTIDADE'\) \{\s+if \(!validarQuantidade\(\)\) return\s+step\.value = 'COMPRADOR'/)
  assert.match(composable, /preencherPrimeiroParticipante\(\)\s+step\.value = 'PARTICIPANTES'/)
})

test('B) campo vazio recebe o nome do comprador', () => {
  assert.equal(nomePrimeiroParticipante('', 'Maria Souza', ''), 'Maria Souza')
  assert.equal(nomePrimeiroParticipante('   ', ' Maria Souza ', ''), 'Maria Souza')
})

test('C) nome digitado pela pessoa nao e sobrescrito', () => {
  assert.equal(nomePrimeiroParticipante('João Lima', 'Maria Souza', 'Maria Souza'), 'João Lima')
})

test('D) se o comprador corrigir o nome, a sugestao acompanha', () => {
  assert.equal(nomePrimeiroParticipante('Maria Sousa', 'Maria Souza', 'Maria Sousa'), 'Maria Souza')
})
