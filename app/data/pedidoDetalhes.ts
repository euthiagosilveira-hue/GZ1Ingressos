import { pedidosMock } from '~/data/pedidos'
import type { OrderDetail, OrderHistoryEvent, OrderListItem } from '~/types/pedido'
import type { OrderPayment } from '~/types/pagamento'
import type { OrderTicket, TicketStatus } from '~/types/ingresso'

function porId(id: string): OrderListItem {
  const pedido = pedidosMock.find((item) => item.id === id)
  if (!pedido) {
    throw new Error(`Pedido mock não encontrado: ${id}`)
  }
  return pedido
}

function statusIngresso(status: OrderListItem['status']): TicketStatus {
  if (status === 'PAGO') return 'VALIDO'
  if (status === 'RESERVADO') return 'RESERVADO'
  if (status === 'EXPIRADO') return 'EXPIRADO'
  return 'CANCELADO'
}

function criarIngressos(pedido: OrderListItem): OrderTicket[] {
  const status = statusIngresso(pedido.status)

  return Array.from({ length: pedido.quantidade }, (_, indice) => ({
    id: `${pedido.id}_ing_${indice + 1}`,
    codigo: `${pedido.codigo}-${String(indice + 1).padStart(2, '0')}`,
    participanteNome: pedido.compradorNome,
    valorUnitario: pedido.valorUnitario,
    status,
    utilizadoEm: null
  }))
}

function criarPagamento(pedido: OrderListItem): OrderPayment {
  const base: Omit<OrderPayment, 'status'> = {
    id: `${pedido.id}_pag`,
    valor: pedido.valorTotal,
    provider: 'STONE',
    transactionId: `txn_${pedido.codigo}`,
    chargeId: `ch_${pedido.codigo}`,
    externalReference: `ref_${pedido.codigo}`,
    expiraEm: null as string | null,
    confirmadoEm: null as string | null,
    canceladoEm: null as string | null,
    reembolsadoEm: null as string | null,
    valorReembolsado: 0
  }

  if (pedido.status === 'PAGO') {
    return { ...base, status: 'APROVADO', confirmadoEm: pedido.pagoEm }
  }
  if (pedido.status === 'RESERVADO') {
    return { ...base, status: 'PENDENTE', expiraEm: pedido.reservaExpiraEm }
  }
  if (pedido.status === 'EXPIRADO') {
    return { ...base, status: 'EXPIRADO', expiraEm: pedido.reservaExpiraEm }
  }

  return { ...base, status: 'CANCELADO', canceladoEm: pedido.canceladoEm }
}

function criarHistorico(pedido: OrderListItem): OrderHistoryEvent[] {
  const eventos: OrderHistoryEvent[] = [
    {
      id: `${pedido.id}_h1`,
      tipo: 'PEDIDO_CRIADO',
      titulo: 'Pedido criado',
      descricao: `Pedido ${pedido.codigo} registrado.`,
      ocorridoEm: pedido.criadoEm
    }
  ]

  if (pedido.status !== 'CANCELADO') {
    eventos.push({
      id: `${pedido.id}_h2`,
      tipo: 'RESERVA_CRIADA',
      titulo: 'Reserva criada',
      descricao: `Reserva de ${pedido.quantidade} ingresso(s).`,
      ocorridoEm: pedido.criadoEm
    })
    eventos.push({
      id: `${pedido.id}_h3`,
      tipo: 'PAGAMENTO_INICIADO',
      titulo: 'Pagamento iniciado',
      descricao: 'Aguardando confirmação do provedor.',
      ocorridoEm: pedido.criadoEm
    })
  }

  if (pedido.status === 'PAGO' && pedido.pagoEm) {
    eventos.push({
      id: `${pedido.id}_h4`,
      tipo: 'PAGAMENTO_APROVADO',
      titulo: 'Pagamento aprovado',
      ocorridoEm: pedido.pagoEm
    })
    eventos.push({
      id: `${pedido.id}_h5`,
      tipo: 'INGRESSOS_LIBERADOS',
      titulo: 'Ingressos liberados',
      ocorridoEm: pedido.pagoEm
    })
  }

  if (pedido.status === 'EXPIRADO' && pedido.reservaExpiraEm) {
    eventos.push({
      id: `${pedido.id}_h6`,
      tipo: 'PEDIDO_EXPIRADO',
      titulo: 'Pedido expirado',
      descricao: 'A reserva ultrapassou o prazo sem confirmação de pagamento.',
      ocorridoEm: pedido.reservaExpiraEm
    })
  }

  if (pedido.status === 'CANCELADO' && pedido.canceladoEm) {
    eventos.push({
      id: `${pedido.id}_h7`,
      tipo: 'PEDIDO_CANCELADO',
      titulo: 'Pedido cancelado',
      ocorridoEm: pedido.canceladoEm
    })
  }

  return eventos
}

function criarDetalhe(
  pedido: OrderListItem,
  overrides: Partial<OrderDetail> = {}
): OrderDetail {
  return {
    ...pedido,
    atualizadoEm: pedido.pagoEm ?? pedido.canceladoEm ?? pedido.criadoEm,
    motivoValorAvulso: null,
    autorizadoPorUsuarioId: null,
    autorizadoPorNome: null,
    pagamento: criarPagamento(pedido),
    ingressos: criarIngressos(pedido),
    historico: criarHistorico(pedido),
    ...overrides
  }
}

const pedido005 = porId('ped_005')
const pedido006 = porId('ped_006')

export const pedidoDetalhesMock: Record<string, OrderDetail> = {
  ped_001: criarDetalhe(porId('ped_001')),
  ped_002: criarDetalhe(porId('ped_002')),
  ped_004: criarDetalhe(porId('ped_004')),
  ped_005: criarDetalhe(pedido005, {
    motivoValorAvulso: 'Valor promocional aprovado pela produção.',
    autorizadoPorUsuarioId: 'usr_admin_001',
    autorizadoPorNome: 'Administrador GZ',
    pagamento: {
      id: 'ped_005_pag',
      status: 'REEMBOLSADO',
      valor: pedido005.valorTotal,
      provider: 'MERCADO_PAGO',
      transactionId: 'txn_GZ100105',
      chargeId: 'ch_GZ100105',
      externalReference: 'ref_GZ100105',
      expiraEm: null,
      confirmadoEm: '2026-09-20T16:50:00-03:00',
      canceladoEm: '2026-09-21T09:00:00-03:00',
      reembolsadoEm: '2026-09-23T12:00:00-03:00',
      valorReembolsado: pedido005.valorTotal
    },
    historico: [
      {
        id: 'ped_005_h1',
        tipo: 'PEDIDO_CRIADO',
        titulo: 'Pedido criado',
        descricao: 'Pedido GZ100105 registrado.',
        ocorridoEm: pedido005.criadoEm
      },
      {
        id: 'ped_005_h2',
        tipo: 'PAGAMENTO_APROVADO',
        titulo: 'Pagamento aprovado',
        ocorridoEm: '2026-09-20T16:50:00-03:00'
      },
      {
        id: 'ped_005_h3',
        tipo: 'PEDIDO_CANCELADO',
        titulo: 'Pedido cancelado',
        ocorridoEm: '2026-09-21T09:00:00-03:00'
      },
      {
        id: 'ped_005_h4',
        tipo: 'REEMBOLSO_SOLICITADO',
        titulo: 'Reembolso solicitado',
        descricao: 'Solicitação registrada pelo administrador.',
        ocorridoEm: '2026-09-22T10:00:00-03:00'
      },
      {
        id: 'ped_005_h5',
        tipo: 'REEMBOLSO_CONCLUIDO',
        titulo: 'Reembolso concluído',
        ocorridoEm: '2026-09-23T12:00:00-03:00'
      }
    ]
  }),
  ped_006: criarDetalhe(pedido006, {
    motivoValorAvulso: 'Ingresso de cortesia para imprensa.',
    autorizadoPorUsuarioId: 'usr_admin_001',
    autorizadoPorNome: 'Administrador GZ',
    ingressos: criarIngressos(pedido006).map((ingresso, indice) =>
      indice === 0
        ? { ...ingresso, status: 'UTILIZADO', utilizadoEm: '2026-09-20T19:30:00-03:00' }
        : ingresso
    )
  })
}

export function buscarPedidoDetalhe(id: string): OrderDetail | null {
  const pedido = pedidosMock.find((item) => item.id === id)
  if (!pedido) return null
  return pedidoDetalhesMock[id] ?? criarDetalhe(pedido)
}
