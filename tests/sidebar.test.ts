import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

const sidebar = ler('../app/components/AdminSidebar.vue')
const shell = ler('../app/components/AdminShell.vue')

test('Pedidos sem badge', () => {
  assert.ok(sidebar.includes("{ to: '/pedidos', icon: RectangleStackIcon, label: 'Pedidos' }"))
  assert.ok(!/label:\s*'Pedidos'[^\n]*badge/.test(sidebar))
})

test('Entradas sem badge', () => {
  assert.ok(sidebar.includes("{ to: '/entradas', icon: ArrowRightOnRectangleIcon, label: 'Entradas' }"))
  assert.ok(!/label:\s*'Entradas'[^\n]*badge/.test(sidebar))
})

test('sidebar nao usa numeros hardcoded nem props de contador', () => {
  assert.ok(!sidebar.includes("'128'"))
  assert.ok(!sidebar.includes("'281'"))
  assert.ok(!/\bbadge\b/.test(sidebar))
  assert.ok(!sidebar.includes('pedidosCount'))
  assert.ok(!sidebar.includes('entradasCount'))
})

test('card do usuario permanece', () => {
  assert.ok(sidebar.includes('operador.nome'))
  assert.ok(sidebar.includes('operador.email'))
  assert.ok(sidebar.includes('Sair'))
})

test('card de ajuda continua removido', () => {
  assert.ok(!sidebar.includes('Precisa de ajuda?'))
  assert.ok(!sidebar.includes('Fale com o suporte'))
  assert.ok(!sidebar.includes('PhoneIcon'))
})

test('layout desktop/mobile preservado e sem camada de contadores', () => {
  assert.ok(shell.includes('class="hidden lg:flex"'))
  assert.ok(/<AdminSidebar[\s\S]*mobile/.test(shell))
  assert.ok(!shell.includes('useAdminSidebarCounts'))
  assert.ok(!shell.includes('pedidosCount'))
  assert.ok(!shell.includes('entradasCount'))
})
