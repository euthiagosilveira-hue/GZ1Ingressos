import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  mapearPedidosRecentes,
  mapearPagamentosPorStatus,
  mapearEntradasPorHora
} from '../app/utils/dashboard.ts'

test('mapearEntradasPorHora preserva hora/entradas', () => {
  const r = mapearEntradasPorHora([
    { hora: '18h', entradas: 3 },
    { hora: '19h', entradas: 0 }
  ])
  assert.equal(r.length, 2)
  assert.equal(r[0].hora, '18h')
  assert.equal(r[0].entradas, 3)
})

test('mapearPagamentosPorStatus atribui cores por key', () => {
  const r = mapearPagamentosPorStatus([
    { key: 'paid', label: 'Pago', value: 10 },
    { key: 'pending', label: 'Pendente', value: 2 },
    { key: 'canceled', label: 'Cancelado', value: 1 }
  ])
  assert.equal(r[0].color, '#22c55e')
  assert.equal(r[1].color, '#fbbf24')
  assert.equal(r[2].color, '#ef4444')
})

test('mapearPedidosRecentes formata codigo/total/pagamento', () => {
  const r = mapearPedidosRecentes([
    {
      pedido_id: 'p1',
      codigo: 'GZ100700',
      buyer: 'Comprador Real',
      tickets: 2,
      total: '80.00',
      status: 'PAGO',
      criado_em: '2026-09-29T12:00:00Z',
      entrance_used: 1
    }
  ])
  assert.equal(r[0].id, '#GZ100700')
  assert.equal(r[0].buyer, 'Comprador Real')
  assert.equal(r[0].tickets, 2)
  assert.equal(r[0].payment, 'Pago')
  assert.equal(r[0].entranceUsed, 1)
  assert.equal(r[0].entranceTotal, 2)
  assert.match(r[0].total, /^R\$\s?80,00$/)
})
