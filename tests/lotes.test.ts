import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mapearEventoLotesParaListItem,
  mapearLoteAdminParaListItem,
  montarAtivacaoEm,
  proximaOrdem,
  type EventoLotesAdminRow,
  type LoteAdminRow
} from '../app/utils/lotes.ts'

test('mapearLoteAdminParaListItem converte a linha real', () => {
  const row: LoteAdminRow = {
    lote_id: 'lote-1',
    nome: 'Lote 1',
    ordem: 1,
    quantidade: 10,
    preco: '50.00',
    tipo_ativacao: 'MANUAL',
    ativacao_em: null,
    ativado_em: '2026-10-29T23:00:00+00:00',
    encerrado_em: null,
    status: 'ATIVO',
    quantidade_vendida: 2,
    quantidade_disponivel: 8
  }
  const item = mapearLoteAdminParaListItem(row)
  assert.equal(item.id, 'lote-1')
  assert.equal(item.nome, 'Lote 1')
  assert.equal(item.preco, 50)
  assert.equal(item.ativacaoEm, null)
  assert.equal(item.ativadoEm, '2026-10-29T23:00:00+00:00')
  assert.equal(item.status, 'ATIVO')
  assert.equal(item.vendidos, 2)
  assert.equal(item.disponiveis, 8)
})

test('mapearEventoLotesParaListItem converte o cabecalho', () => {
  const row: EventoLotesAdminRow = {
    evento_id: 'evt-1',
    nome: 'Evento',
    status: 'AGENDADO',
    vendas_status: 'ABERTAS',
    publicacao_status: 'PUBLICADO',
    inicio_em: '2026-10-29T23:00:00+00:00',
    local: 'Galeria',
    imagem_url: null,
    capacidade_total: 500,
    estoque_antecipado: 100,
    vendidos: 2,
    disponiveis: 98
  }
  const evento = mapearEventoLotesParaListItem(row)
  assert.equal(evento.id, 'evt-1')
  assert.equal(evento.nome, 'Evento')
  assert.equal(evento.status, 'AGENDADO')
  assert.equal(evento.vendasStatus, 'ABERTAS')
  assert.equal(evento.publicacaoStatus, 'PUBLICADO')
  assert.equal(evento.inicioEm, '2026-10-29T23:00:00+00:00')
  assert.equal(evento.local, 'Galeria')
  assert.equal(evento.vendidos, 2)
  assert.equal(evento.disponiveis, 98)
})

test('montarAtivacaoEm interpreta America/Sao_Paulo e retorna instante UTC', () => {
  assert.equal(montarAtivacaoEm('2026-10-29', '20:00'), '2026-10-29T23:00:00.000Z')
  assert.equal(montarAtivacaoEm('2026-10-29', '09:30'), '2026-10-29T12:30:00.000Z')
  assert.equal(montarAtivacaoEm('2026-10-29', '00:00'), '2026-10-29T03:00:00.000Z')
  assert.equal(montarAtivacaoEm('2026-10-31', '23:30'), '2026-11-01T02:30:00.000Z')
  assert.equal(montarAtivacaoEm('', '20:00'), null)
  assert.equal(montarAtivacaoEm('2026-10-29', ''), null)
})

test('proximaOrdem calcula max+1', () => {
  assert.equal(proximaOrdem([]), 1)
  assert.equal(
    proximaOrdem([
      { id: 'a', eventoId: '', nome: 'L1', ordem: 1, quantidade: 1, preco: 1, tipoAtivacao: 'MANUAL', ativacaoEm: null, ativadoEm: null, encerradoEm: null, status: 'INATIVO', vendidos: 0, disponiveis: 1 },
      { id: 'b', eventoId: '', nome: 'L2', ordem: 3, quantidade: 1, preco: 1, tipoAtivacao: 'MANUAL', ativacaoEm: null, ativadoEm: null, encerradoEm: null, status: 'INATIVO', vendidos: 0, disponiveis: 1 }
    ]),
    4
  )
})
