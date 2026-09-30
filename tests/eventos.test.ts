import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mapearEventoAdminParaListItem, gerarSlug, montarInicioEm } from '../app/utils/eventos.ts'

test('mapearEventoAdminParaListItem adapta o item real para o shape dos cards', () => {
  const item = mapearEventoAdminParaListItem({
    eventoId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    nome: 'Evento Real',
    slug: 'evento-real',
    inicioEm: '2026-10-25T19:19:10.781Z',
    local: 'Galeria Zero 1',
    status: 'EM_ANDAMENTO',
    vendasStatus: 'ENCERRADAS',
    publicacaoStatus: 'PUBLICADO',
    capacidadeTotal: 200,
    estoqueAntecipado: 100,
    publicadoEm: '2026-09-01T00:00:00Z',
    lotesCount: 2,
    pedidosCount: 7,
    ingressosCount: 9
  })

  assert.equal(item.id, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
  assert.equal(item.nome, 'Evento Real')
  assert.equal(item.slug, 'evento-real')
  assert.equal(item.status, 'EM_ANDAMENTO')
  assert.equal(item.publicacaoStatus, 'PUBLICADO')
  assert.equal(item.vendasStatus, 'ENCERRADAS')
  assert.equal(item.vendidos, 9)
  assert.equal(item.imagemUrl, null)
  assert.equal(item.loteAtual, null)
})

test('gerarSlug normaliza acentos/espacos/simbolos', () => {
  assert.equal(gerarSlug('Meu Evento Show!'), 'meu-evento-show')
  assert.equal(gerarSlug('  Banda  Conexão  '), 'banda-conexao')
  assert.equal(gerarSlug('Ação--2026'), 'acao-2026')
})

test('montarInicioEm interpreta America/Sao_Paulo e retorna instante UTC', () => {
  // A) 20:00 local (UTC-3) => 23:00Z
  assert.equal(montarInicioEm('2026-10-29', '20:00'), '2026-10-29T23:00:00.000Z')
  // B) horario da manha
  assert.equal(montarInicioEm('2026-10-29', '09:30'), '2026-10-29T12:30:00.000Z')
  // C) meia-noite local => 03:00Z
  assert.equal(montarInicioEm('2026-10-29', '00:00'), '2026-10-29T03:00:00.000Z')
  // D) virada de mes
  assert.equal(montarInicioEm('2026-10-31', '23:30'), '2026-11-01T02:30:00.000Z')
  // E) valor nao e ambiguo (contem Z)
  assert.equal(montarInicioEm('2026-10-29', '20:00').endsWith('Z'), true)
  // vazio
  assert.equal(montarInicioEm('', '20:00'), '')
  assert.equal(montarInicioEm('2026-10-29', ''), '')
})
