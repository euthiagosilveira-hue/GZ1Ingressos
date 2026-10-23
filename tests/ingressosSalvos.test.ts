import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  CHAVE_INGRESSOS_SALVOS,
  LIMITE_INGRESSOS_SALVOS,
  lerIngressosSalvos,
  removerIngressoSalvo,
  salvarIngresso
} from '../app/utils/ingressosSalvos.ts'

function memoria(inicial?: string) {
  const dados = new Map<string, string>()
  if (inicial !== undefined) dados.set(CHAVE_INGRESSOS_SALVOS, inicial)
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => void dados.set(k, v)
  }
}

const base = {
  checkoutToken: 'tok-1',
  codigoPedido: 'GZ100001',
  eventoNome: 'Evento A',
  eventoSlug: 'evento-a',
  eventoInicioEm: '2026-11-01T22:00:00Z'
}

test('salva, le e nao duplica o mesmo pedido', () => {
  const s = memoria()
  salvarIngresso(s, base)
  salvarIngresso(s, { ...base, eventoInicioEm: null })
  const lista = lerIngressosSalvos(s)
  assert.equal(lista.length, 1)
  assert.equal(lista[0].eventoInicioEm, '2026-11-01T22:00:00Z')
})

test('pedido mais recente fica no topo e respeita o limite', () => {
  const s = memoria()
  for (let i = 0; i < LIMITE_INGRESSOS_SALVOS + 5; i++) {
    salvarIngresso(s, { ...base, checkoutToken: `tok-${i}` })
  }
  const lista = lerIngressosSalvos(s)
  assert.equal(lista.length, LIMITE_INGRESSOS_SALVOS)
  assert.equal(lista[0].checkoutToken, `tok-${LIMITE_INGRESSOS_SALVOS + 4}`)
})

test('remove pedido salvo', () => {
  const s = memoria()
  salvarIngresso(s, base)
  salvarIngresso(s, { ...base, checkoutToken: 'tok-2' })
  assert.deepEqual(removerIngressoSalvo(s, 'tok-1').map((i) => i.checkoutToken), ['tok-2'])
})

test('dados corrompidos ou sem navegador nao quebram', () => {
  assert.deepEqual(lerIngressosSalvos(memoria('{nao e json')), [])
  assert.deepEqual(lerIngressosSalvos(memoria('[{"x":1}]')), [])
  assert.deepEqual(lerIngressosSalvos(null), [])
  assert.deepEqual(salvarIngresso(null, base), [])
})
