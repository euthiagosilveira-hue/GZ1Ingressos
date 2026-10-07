import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  ajustarParticipantes,
  calcularTotalVendaManual,
  mapearEventoVendaManual,
  mensagemErroVendaManual,
  montarPayloadVendaManual,
  validarVendaManual
} from '../app/utils/vendaManual.ts'
import type { EventoVendaManual, VendaManualForm } from '../app/types/vendaManual.ts'

function eventoBase(lote: EventoVendaManual['loteAtivo']): EventoVendaManual {
  return {
    id: 'e1',
    nome: 'Evento Teste',
    inicioEm: '2026-10-25T19:00:00Z',
    local: 'Galeria',
    status: 'AGENDADO',
    loteAtivo: lote
  }
}

function formBase(overrides: Partial<VendaManualForm> = {}): VendaManualForm {
  return {
    eventoId: 'e1',
    loteId: 'l1',
    compradorNome: 'Maria',
    compradorTelefone: '11999990000',
    compradorEmail: '',
    quantidade: 2,
    participantes: ['Maria', 'João'],
    ...overrides
  }
}

test('calcularTotalVendaManual multiplica preco por quantidade', () => {
  assert.equal(calcularTotalVendaManual(37.5, 2), 75)
  assert.equal(calcularTotalVendaManual(0.1, 3), 0.3)
  assert.equal(calcularTotalVendaManual(10, 0), 0)
  assert.equal(calcularTotalVendaManual(0, 5), 0)
})

test('ajustarParticipantes cresce com vazio e corta excedente', () => {
  assert.deepEqual(ajustarParticipantes([], 3, 'Maria'), ['Maria', '', ''])
  assert.deepEqual(ajustarParticipantes(['A', 'B', 'C'], 2, 'Maria'), ['A', 'B'])
})

test('mapearEventoVendaManual converte a linha real', () => {
  const evento = mapearEventoVendaManual({
    evento_id: 'e1',
    nome: 'Festa',
    inicio_em: '2026-10-25T19:00:00Z',
    local: 'Galeria Zero',
    status: 'EM_ANDAMENTO',
    lote_ativo_id: 'l1',
    lote_ativo_nome: 'Lote 1',
    lote_ativo_preco: '37.50',
    lote_ativo_disponiveis: 5
  })
  assert.equal(evento.status, 'EM_ANDAMENTO')
  assert.equal(evento.loteAtivo?.preco, 37.5)
  assert.equal(evento.loteAtivo?.disponiveis, 5)
})

test('mapearEventoVendaManual trata ausencia de lote ativo', () => {
  const evento = mapearEventoVendaManual({
    evento_id: 'e1',
    nome: 'Festa',
    inicio_em: '2026-10-25T19:00:00Z',
    local: 'Galeria Zero',
    status: 'AGENDADO',
    lote_ativo_id: null,
    lote_ativo_nome: null,
    lote_ativo_preco: null,
    lote_ativo_disponiveis: null
  })
  assert.equal(evento.loteAtivo, null)
})

test('validarVendaManual aceita formulario consistente', () => {
  const erros = validarVendaManual(
    formBase(),
    eventoBase({ id: 'l1', nome: 'Lote', preco: 37.5, disponiveis: 5 })
  )
  assert.deepEqual(erros, {})
})

test('validarVendaManual aponta campos obrigatorios', () => {
  const erros = validarVendaManual(
    formBase({ eventoId: '', compradorNome: '  ', compradorTelefone: '' }),
    null
  )
  assert.ok(erros.eventoId)
  assert.ok(erros.loteId)
  assert.ok(erros.compradorNome)
  assert.ok(erros.compradorTelefone)
})

test('validarVendaManual rejeita quantidade fora de 1..10', () => {
  const evento = eventoBase({ id: 'l1', nome: 'Lote', preco: 10, disponiveis: 50 })
  assert.ok(validarVendaManual(formBase({ quantidade: 0, participantes: [] }), evento).quantidade)
  assert.ok(
    validarVendaManual(
      formBase({ quantidade: 11, participantes: Array(11).fill('P') }),
      evento
    ).quantidade
  )
})

test('validarVendaManual exige participantes e nomes nao vazios', () => {
  const evento = eventoBase({ id: 'l1', nome: 'Lote', preco: 10, disponiveis: 50 })
  assert.ok(
    validarVendaManual(formBase({ quantidade: 2, participantes: ['Maria'] }), evento).participantes
  )
  assert.ok(
    validarVendaManual(formBase({ quantidade: 2, participantes: ['Maria', '  '] }), evento)
      .participantes
  )
})

test('montarPayloadVendaManual trims, converte email vazio em null e corta participantes', () => {
  const payload = montarPayloadVendaManual(
    formBase({
      compradorNome: '  Maria  ',
      compradorTelefone: ' 11999990000 ',
      compradorEmail: '   ',
      quantidade: 1,
      participantes: ['  Maria  ', 'ignorado']
    })
  )
  assert.deepEqual(payload, {
    eventoId: 'e1',
    loteId: 'l1',
    compradorNome: 'Maria',
    compradorTelefone: '11999990000',
    compradorEmail: null,
    participantes: ['Maria']
  })
})

test('mensagemErroVendaManual traduz permissao e estoque', () => {
  assert.equal(
    mensagemErroVendaManual({ code: '42501', message: 'Permissao negada' }),
    'Você não tem permissão para registrar vendas manuais.'
  )
  assert.equal(
    mensagemErroVendaManual({ message: 'Estoque insuficiente no evento (disponivel=0, solicitado=1)' }),
    'Estoque insuficiente no evento.'
  )
  assert.equal(
    mensagemErroVendaManual({ message: 'Limite do lote insuficiente (disponivel=0, solicitado=1)' }),
    'Estoque insuficiente no lote selecionado.'
  )
  assert.equal(
    mensagemErroVendaManual({ message: 'Lote x nao esta ATIVO (status=INATIVO)' }),
    'O lote selecionado não está ativo.'
  )
  assert.equal(
    mensagemErroVendaManual({ code: '23514', message: 'algo' }),
    'Não foi possível concluir a venda. Verifique os dados informados.'
  )
  assert.equal(
    mensagemErroVendaManual(null),
    'Não foi possível registrar a venda manual.'
  )
})
