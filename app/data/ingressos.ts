import { buscarPedidoDetalhe } from '~/data/pedidoDetalhes'
import { pedidosMock } from '~/data/pedidos'
import type { TicketListItem } from '~/types/ingresso'

function derivarIngressos(): TicketListItem[] {
  return pedidosMock.flatMap((pedido) => {
    const detalhe = buscarPedidoDetalhe(pedido.id)
    if (!detalhe) return []

    return detalhe.ingressos.map((ingresso) => ({
      ...ingresso,
      pedidoId: pedido.id,
      pedidoCodigo: pedido.codigo,
      eventoId: pedido.eventoId,
      eventoNome: pedido.eventoNome,
      loteId: pedido.loteId,
      loteNome: pedido.loteNome,
      criadoEm: pedido.criadoEm
    }))
  })
}

export const ingressosMock: TicketListItem[] = derivarIngressos()
