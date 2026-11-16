import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  SCHEMA_FECHAMENTO_BAR,
  corpoPedidoGemini,
  fechamentoVazio,
  interpretarFechamentoBar,
  promptFechamentoBar
} from '../server/utils/leitura-comprovante.ts'
import { contaCartaoBar, distribuirFechamentoBar } from '../app/utils/caixa.ts'
import type { ContaCaixa } from '../app/types/caixa.ts'

const hoje = '2026-11-16'

function conta(id: string, nome: string, tipo: ContaCaixa['tipo'], ativa = true): ContaCaixa {
  return {
    id,
    nome,
    tipo,
    provedorIngressos: null,
    saldoInicial: 0,
    saldoInicialEm: null,
    configurada: true,
    ativa,
    saldoAtual: 0
  }
}

const contas = [
  conta('itau', 'Itaú', 'BANCO'),
  conta('stone', 'Stone', 'MAQUININHA'),
  conta('caixa', 'Caixa físico', 'DINHEIRO'),
  conta('mp', 'Mercado Pago', 'ONLINE')
]

test('le o fechamento com formas de pagamento em formato brasileiro', () => {
  const l = interpretarFechamentoBar(
    JSON.stringify({ data: '15/11/2026', dinheiro: '1.200,50', credito: 8000, debito: '5000.25', pix: 2000, outros: null, total: 16200.75 }),
    hoje
  )
  assert.deepEqual(l, {
    data: '2026-11-15',
    dinheiro: 1200.5,
    credito: 8000,
    debito: 5000.25,
    pix: 2000,
    outros: null,
    total: 16200.75
  })
  assert.equal(fechamentoVazio(l), false)
})

test('zero e aceito, negativo e lixo viram vazio', () => {
  const l = interpretarFechamentoBar('```json\n{"dinheiro":0,"credito":-5,"pix":"abc"}\n```', hoje)
  assert.equal(l.dinheiro, 0)
  assert.equal(l.credito, null)
  assert.equal(l.pix, null)
})

test('resposta sem valores e leitura vazia (so a data nao basta)', () => {
  assert.equal(fechamentoVazio(interpretarFechamentoBar('{"data":"2026-11-15"}', hoje)), true)
  assert.equal(fechamentoVazio(interpretarFechamentoBar('nada', hoje)), true)
})

test('pedido ao Gemini usa o formato do fechamento', () => {
  const pedido = corpoPedidoGemini({ base64: 'x', mimeType: 'image/jpeg', prompt: promptFechamentoBar(hoje), schema: SCHEMA_FECHAMENTO_BAR })
  const config = pedido.generationConfig as { responseSchema: unknown }
  assert.equal(config.responseSchema, SCHEMA_FECHAMENTO_BAR)
  assert.match(promptFechamentoBar(hoje), /sangria/)
})

test('cartao e Pix vao para o Itau, dinheiro para o caixa fisico', () => {
  const r = distribuirFechamentoBar(
    { data: null, dinheiro: 1200.5, credito: 8000, debito: 5000.25, pix: 2000, outros: null, total: 16200.75 },
    contas
  )
  assert.deepEqual(r.valores, { itau: 15000.25, caixa: 1200.5 })
  assert.equal(r.detalhes.itau, 'Crédito R$ 8.000,00 · Débito R$ 5.000,25 · Pix R$ 2.000,00')
  assert.equal(r.detalhes.caixa, 'Dinheiro R$ 1.200,50')
  assert.equal(r.soma, 16200.75)
  assert.equal(r.diferenca, 0)
})

test('aponta diferenca quando a soma nao bate com o total', () => {
  const r = distribuirFechamentoBar(
    { data: null, dinheiro: 100, credito: 200, debito: null, pix: null, outros: null, total: 350 },
    contas
  )
  assert.equal(r.diferenca, 50)
})

test('sem formas de pagamento nao preenche nada', () => {
  const r = distribuirFechamentoBar(
    { data: null, dinheiro: null, credito: null, debito: null, pix: null, outros: null, total: 500 },
    contas
  )
  assert.deepEqual(r.valores, {})
  assert.equal(r.diferenca, 0)
})

test('conta do cartao: Itau, senao outro banco, senao maquininha', () => {
  assert.equal(contaCartaoBar(contas)?.id, 'itau')
  assert.equal(contaCartaoBar([conta('b', 'Banco X', 'BANCO'), conta('s', 'Stone', 'MAQUININHA')])?.id, 'b')
  assert.equal(contaCartaoBar([conta('s', 'Stone', 'MAQUININHA'), conta('m', 'MP', 'ONLINE')])?.id, 's')
  assert.equal(contaCartaoBar([conta('i', 'Itaú', 'BANCO', false)]), null)
})
