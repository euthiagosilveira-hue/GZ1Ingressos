import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { mapearContadoresAdmin } from '../app/utils/sidebar.ts'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

const sidebar = ler('../app/components/AdminSidebar.vue')
const shell = ler('../app/components/AdminShell.vue')

test('A) sidebar nao usa numeros hardcoded (128/281)', () => {
  assert.ok(!sidebar.includes("'128'"))
  assert.ok(!sidebar.includes("'281'"))
  assert.ok(!/badge:\s*['"]?\d/.test(sidebar))
})

test('B) badge Pedidos usa contador real (prop), nao valor fixo', () => {
  assert.ok(sidebar.includes('pedidosCount'))
  assert.ok(/label:\s*'Pedidos',\s*badge:\s*props\.pedidosCount/.test(sidebar))
})

test('C) badge Entradas usa contador real (prop), nao valor fixo', () => {
  assert.ok(sidebar.includes('entradasCount'))
  assert.ok(/label:\s*'Entradas',\s*badge:\s*props\.entradasCount/.test(sidebar))
})

test('D) card "Precisa de ajuda?" foi removido', () => {
  assert.ok(!sidebar.includes('Precisa de ajuda?'))
  assert.ok(!sidebar.includes('Fale com o suporte'))
  assert.ok(!sidebar.includes('PhoneIcon'))
})

test('E) card do usuario permanece', () => {
  assert.ok(sidebar.includes('operador.nome'))
  assert.ok(sidebar.includes('operador.email'))
  assert.ok(sidebar.includes('Sair'))
})

test('F) layout preservado: shell monta sidebar desktop e mobile com os contadores', () => {
  assert.ok(/<AdminSidebar[\s\S]*class="hidden lg:flex"[\s\S]*:pedidos-count="pedidosCount"[\s\S]*:entradas-count="entradasCount"/.test(shell))
  assert.ok(/<AdminSidebar[\s\S]*mobile[\s\S]*:pedidos-count="pedidosCount"[\s\S]*:entradas-count="entradasCount"/.test(shell))
})

test('mapearContadoresAdmin aceita jsonb real', () => {
  assert.deepEqual(mapearContadoresAdmin({ pedidos: 3, entradas: 2 }), { pedidos: 3, entradas: 2 })
  assert.deepEqual(mapearContadoresAdmin({ pedidos: '7', entradas: '0' }), { pedidos: 7, entradas: 0 })
})

test('mapearContadoresAdmin oculta badge (null) para fonte invalida', () => {
  assert.equal(mapearContadoresAdmin(null), null)
  assert.equal(mapearContadoresAdmin(undefined), null)
  assert.equal(mapearContadoresAdmin({}), null)
  assert.equal(mapearContadoresAdmin({ pedidos: 'x', entradas: 2 }), null)
})

test('mapearContadoresAdmin nunca retorna contadores negativos', () => {
  assert.deepEqual(mapearContadoresAdmin({ pedidos: -5, entradas: -1 }), { pedidos: 0, entradas: 0 })
})
