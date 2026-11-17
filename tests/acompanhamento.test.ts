import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  filtrarVendasPorNome,
  formatarDiaVenda,
  mapearEventoAcompanhamentoDetalhe,
  mapearVendaAcompanhamento,
  mensagemErroAcompanhamento
} from '../app/utils/acompanhamento.ts'
import { destinoAposConvite } from '../app/utils/convite.ts'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

test('mapeia o resumo de vendas do evento (R$, por lote, por dia)', () => {
  const e = mapearEventoAcompanhamentoDetalhe({
    evento_id: 'e1',
    nome: 'Show',
    slug: 'show',
    inicio_em: '2026-11-20T23:00:00Z',
    status: 'AGENDADO',
    capacidade_total: 200,
    utilizados: 3,
    lote_ativo: { nome: 'Lote 1', preco: '40.00' },
    resumo: {
      pedidos_pagos: 2,
      ingressos: 5,
      valor_total: '200.00',
      valor_online: '160.00',
      valor_portaria: '40.00',
      por_lote: [
        { lote_id: 'l1', nome: 'Lote 1', preco: '40.00', disponibilizados: 100, status: 'ATIVO', ingressos: 4, valor: '160.00' },
        { lote_id: null, nome: 'Sem lote', preco: null, disponibilizados: null, status: null, ingressos: 1, valor: '40.00' }
      ],
      por_dia: [{ dia: '2026-11-17', ingressos: 5, valor: '200.00' }]
    }
  })
  assert.equal(e.resumo.valorTotal, 200)
  assert.equal(e.resumo.valorOnline, 160)
  assert.equal(e.resumo.ingressos, 5)
  assert.equal(e.resumo.porLote.length, 2)
  assert.equal(e.resumo.porLote[0].valor, 160)
  assert.equal(e.resumo.porLote[1].loteId, null)
  assert.equal(e.resumo.porLote[1].preco, null)
  assert.equal(e.resumo.porDia[0].valor, 200)
  assert.equal(e.loteAtivo?.preco, 40)
  assert.equal(e.capacidadeTotal, 200)
})

test('resumo vazio nao quebra a tela', () => {
  const e = mapearEventoAcompanhamentoDetalhe({ evento_id: 'e1', resumo: null })
  assert.equal(e.resumo.valorTotal, 0)
  assert.deepEqual(e.resumo.porLote, [])
  assert.deepEqual(e.resumo.porDia, [])
  assert.equal(e.loteAtivo, null)
})

test('venda mapeada nao carrega telefone/e-mail', () => {
  const v = mapearVendaAcompanhamento({
    codigo: 'GZ1',
    comprador_nome: 'Ana',
    comprador_telefone: '34999990000',
    comprador_email: 'ana@x.com',
    quantidade: 2,
    valor_total: '80',
    lote_nome: 'Lote 1',
    forma: 'PORTARIA',
    pago_em: '2026-11-17T12:00:00Z'
  })
  assert.equal(v.compradorNome, 'Ana')
  assert.equal(v.forma, 'PORTARIA')
  assert.equal(v.valorTotal, 80)
  assert.equal(JSON.stringify(v).includes('34999990000'), false)
  assert.equal(JSON.stringify(v).includes('ana@x.com'), false)
})

test('busca de comprador ignora acento e maiusculas', () => {
  const vendas = [
    mapearVendaAcompanhamento({ codigo: 'A1', comprador_nome: 'João Silva' }),
    mapearVendaAcompanhamento({ codigo: 'B2', comprador_nome: 'Maria' })
  ]
  assert.equal(filtrarVendasPorNome(vendas, 'joao').length, 1)
  assert.equal(filtrarVendasPorNome(vendas, '  ').length, 2)
  assert.equal(filtrarVendasPorNome(vendas, 'b2')[0].compradorNome, 'Maria')
})

test('formatarDiaVenda mostra dia da semana e data', () => {
  assert.equal(formatarDiaVenda('2026-11-17'), 'ter, 17/11')
  assert.equal(formatarDiaVenda('xx'), 'xx')
})

test('mensagens de erro amigaveis', () => {
  assert.match(mensagemErroAcompanhamento({ code: '42501', message: 'Permissao negada' }, 'x'), /não está ativo/)
  assert.equal(mensagemErroAcompanhamento({ code: '23503', message: 'Evento nao encontrado' }, 'x'), 'Evento não encontrado.')
  assert.equal(mensagemErroAcompanhamento(null, 'padrão'), 'padrão')
})

test('convite de ACOMPANHAMENTO leva para /acompanhamento', () => {
  assert.equal(destinoAposConvite('ACOMPANHAMENTO'), '/acompanhamento')
})

test('telas de acompanhamento usam o middleware proprio e nao tem acoes de alteracao', () => {
  for (const arquivo of ['../app/pages/acompanhamento/index.vue', '../app/pages/acompanhamento/eventos/[id].vue']) {
    const src = ler(arquivo)
    assert.match(src, /middleware: \['acompanhamento-auth'\]/)
    assert.match(src, /layout: 'acompanhamento-layout'/)
    assert.doesNotMatch(src, /adicionar|remover|cancelar|editar/i)
  }
})

test('painel admin e portaria mandam ACOMPANHAMENTO para a area dele', () => {
  assert.match(ler('../app/middleware/admin-auth.ts'), /areaPropriaPerfil/)
  assert.match(ler('../app/middleware/operator-auth.ts'), /areaPropriaPerfil/)
  assert.match(ler('../app/pages/abrir.vue'), /'\/acompanhamento'/)
})

test('formulario do evento tem o bloco de acompanhamento', () => {
  assert.match(ler('../app/components/eventos/EventForm.vue'), /<EventAcompanhamentoSection :evento-id="props.eventoId" \/>/)
})
