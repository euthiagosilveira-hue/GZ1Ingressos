import { eventosMock } from '~/data/eventos'
import { buscarPedidoDetalhe } from '~/data/pedidoDetalhes'
import { ingressosMock } from '~/data/ingressos'
import type { TicketDetail, TicketHistoryEvent, TicketListItem } from '~/types/ingresso'
import type { OrderDetail } from '~/types/pedido'

function criarHistorico(
  ingresso: TicketListItem,
  detalhe: OrderDetail | null
): TicketHistoryEvent[] {
  const eventos: TicketHistoryEvent[] = [
    {
      id: `${ingresso.id}_h1`,
      tipo: 'INGRESSO_RESERVADO',
      titulo: 'Ingresso reservado',
      descricao: `Ingresso ${ingresso.codigo} reservado.`,
      ocorridoEm: ingresso.criadoEm
    }
  ]

  if (detalhe?.pagamento?.confirmadoEm) {
    eventos.push({
      id: `${ingresso.id}_h2`,
      tipo: 'PAGAMENTO_CONFIRMADO',
      titulo: 'Pagamento confirmado',
      ocorridoEm: detalhe.pagamento.confirmadoEm
    })
  }

  if (ingresso.status === 'VALIDO' || ingresso.status === 'UTILIZADO') {
    eventos.push({
      id: `${ingresso.id}_h3`,
      tipo: 'INGRESSO_LIBERADO',
      titulo: 'Ingresso liberado',
      descricao: 'Ingresso apto para entrada.',
      ocorridoEm: detalhe?.pagoEm ?? ingresso.criadoEm
    })
  }

  if (ingresso.status === 'UTILIZADO' && ingresso.utilizadoEm) {
    eventos.push({
      id: `${ingresso.id}_h4`,
      tipo: 'ENTRADA_REGISTRADA',
      titulo: 'Entrada registrada',
      ocorridoEm: ingresso.utilizadoEm
    })
  }

  if (ingresso.status === 'EXPIRADO') {
    eventos.push({
      id: `${ingresso.id}_h5`,
      tipo: 'INGRESSO_EXPIRADO',
      titulo: 'Ingresso expirado',
      descricao: 'O ingresso expirou junto com a reserva.',
      ocorridoEm: detalhe?.reservaExpiraEm ?? ingresso.criadoEm
    })
  }

  if (ingresso.status === 'CANCELADO') {
    eventos.push({
      id: `${ingresso.id}_h6`,
      tipo: 'INGRESSO_CANCELADO',
      titulo: 'Ingresso cancelado',
      descricao: 'O ingresso foi cancelado e não pode ser utilizado.',
      ocorridoEm: detalhe?.canceladoEm ?? ingresso.criadoEm
    })
  }

  return eventos
}

function criarDetalhe(ingresso: TicketListItem): TicketDetail {
  const detalhe = buscarPedidoDetalhe(ingresso.pedidoId)
  const evento = eventosMock.find((item) => item.id === ingresso.eventoId) ?? null

  return {
    ...ingresso,
    pedidoStatus: detalhe?.status ?? 'PAGO',
    tipoPreco: detalhe?.tipoPreco ?? (ingresso.loteId ? 'LOTE' : 'AVULSO'),
    eventoInicioEm: evento?.inicioEm ?? null,
    eventoLocal: evento?.local ?? null,
    valorPedido: detalhe?.valorTotal ?? ingresso.valorUnitario,
    qrMockValue: `DEMO-${ingresso.codigo}`,
    historico: criarHistorico(ingresso, detalhe)
  }
}

export const ingressoDetalhesMock: Record<string, TicketDetail> = ingressosMock.reduce<
  Record<string, TicketDetail>
>((acumulado, ingresso) => {
  acumulado[ingresso.id] = criarDetalhe(ingresso)
  return acumulado
}, {})

export function buscarIngressoDetalhe(id: string): TicketDetail | null {
  return ingressoDetalhesMock[id] ?? null
}
