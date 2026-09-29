import { test } from 'node:test'
import assert from 'node:assert/strict'

import { mapearEventoAdminParaListItem } from '../app/utils/eventos.ts'

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
