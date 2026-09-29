import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  formatarTelefone,
  mapearPedidoAdminParaDetalhe,
  mapearPedidoAdminParaListItem
} from '../app/utils/pedidos.ts'

test('formatarTelefone formata 11 e 10 digitos', () => {
  assert.equal(formatarTelefone('11999990000'), '(11) 99999-0000')
  assert.equal(formatarTelefone('1133334444'), '(11) 3333-4444')
  assert.equal(formatarTelefone(null), '')
})

test('mapearPedidoAdminParaListItem adapta a linha real ao view-model', () => {
  const item = mapearPedidoAdminParaListItem({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    codigo: 'GZ100200',
    evento_id: 'e1e1e1e1-1111-2222-3333-444444444444',
    evento_nome: 'Evento Real',
    lote_id: null,
    lote_nome: null,
    comprador_nome: 'Comprador Real',
    comprador_telefone: '11999990000',
    comprador_email: 'c@test.local',
    quantidade: 2,
    tipo_preco: 'LOTE',
    valor_unitario: '40.00',
    valor_total: '80.00',
    status: 'PAGO',
    reserva_expira_em: null,
    pago_em: '2026-09-29T12:00:00Z',
    cancelado_em: null,
    criado_em: '2026-09-29T11:59:00Z',
    atualizado_em: null,
    motivo_valor_avulso: null,
    autorizado_por_nome: null,
    pagamento_status: 'APROVADO',
    pagamento_valor: '80.00'
  })

  assert.equal(item.codigo, 'GZ100200')
  assert.equal(item.eventoNome, 'Evento Real')
  assert.equal(item.telefone, '(11) 99999-0000')
  assert.equal(item.valorTotal, 80)
  assert.equal(item.tipoPreco, 'LOTE')
  assert.equal(item.status, 'PAGO')
})

test('mapearPedidoAdminParaDetalhe monta pagamento, ingressos e historico', () => {
  const det = mapearPedidoAdminParaDetalhe({
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    codigo: 'GZ100200',
    evento_id: 'e1e1e1e1-1111-2222-3333-444444444444',
    evento_nome: 'Evento Real',
    lote_id: null,
    lote_nome: null,
    comprador_nome: 'Comprador Real',
    comprador_telefone: '11999990000',
    comprador_email: 'c@test.local',
    quantidade: 1,
    tipo_preco: 'LOTE',
    valor_unitario: '40.00',
    valor_total: '40.00',
    status: 'PAGO',
    reserva_expira_em: null,
    pago_em: '2026-09-29T12:00:00Z',
    cancelado_em: null,
    criado_em: '2026-09-29T11:59:00Z',
    atualizado_em: '2026-09-29T12:00:00Z',
    motivo_valor_avulso: null,
    autorizado_por_nome: null,
    pagamento_status: 'APROVADO',
    pagamento_valor: '40.00',
    evento_inicio_em: '2026-10-25T19:19:10Z',
    evento_local: 'Galeria Zero 1',
    pagamento: {
      id: 'pg1',
      status: 'APROVADO',
      valor: '40.00',
      provedor: 'MERCADO_PAGO',
      transacao_id: 'PAY1',
      cobranca_id: 'ORD1',
      referencia_externa: 'ref1',
      expira_em: null,
      confirmado_em: '2026-09-29T12:00:00Z',
      cancelado_em: null,
      reembolsado_em: null,
      valor_reembolsado: 0
    },
    ingressos: [
      {
        id: 'i1',
        codigo: 'GZ100200-01',
        participante_nome: 'Comprador Real',
        valor_unitario: '40.00',
        status: 'VALIDO',
        utilizado_em: null
      }
    ]
  })

  assert.equal(det.pagamento?.status, 'APROVADO')
  assert.equal(det.pagamento?.provider, 'MERCADO_PAGO')
  assert.equal(det.ingressos.length, 1)
  assert.equal(det.ingressos[0].status, 'VALIDO')
  assert.equal(det.historico.some((h) => h.tipo === 'PAGAMENTO_APROVADO'), true)
  assert.equal(det.historico.some((h) => h.tipo === 'INGRESSOS_LIBERADOS'), true)
})
