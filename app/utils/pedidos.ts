import type {
  OrderFiltersState,
  OrderListItem,
  OrderSort,
  OrderSummaryData
} from '~/types/pedido'

export function filtrarPedidos(
  pedidos: OrderListItem[],
  filtros: OrderFiltersState
): OrderListItem[] {
  const busca = filtros.busca.trim().toLowerCase()

  return pedidos.filter((pedido) => {
    if (busca) {
      const combina =
        pedido.codigo.toLowerCase().includes(busca) ||
        pedido.compradorNome.toLowerCase().includes(busca)
      if (!combina) return false
    }

    if (filtros.eventoId !== 'TODOS' && pedido.eventoId !== filtros.eventoId) {
      return false
    }

    if (filtros.status !== 'TODOS' && pedido.status !== filtros.status) {
      return false
    }

    if (filtros.tipoPreco !== 'TODOS' && pedido.tipoPreco !== filtros.tipoPreco) {
      return false
    }

    return true
  })
}

export function ordenarPedidos(
  pedidos: OrderListItem[],
  ordenacao: OrderSort
): OrderListItem[] {
  const copia = [...pedidos]

  copia.sort((a, b) => {
    const diferenca = new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
    return ordenacao === 'ANTIGOS' ? diferenca : -diferenca
  })

  return copia
}

export function resumoPedidos(pedidos: OrderListItem[]): OrderSummaryData {
  return pedidos.reduce<OrderSummaryData>(
    (acumulado, pedido) => {
      acumulado.total += 1

      if (pedido.status === 'PAGO') {
        acumulado.pagos += 1
        acumulado.valorPago += pedido.valorTotal
      } else if (pedido.status === 'RESERVADO') {
        acumulado.reservados += 1
      } else if (pedido.status === 'EXPIRADO') {
        acumulado.expirados += 1
      } else if (pedido.status === 'CANCELADO') {
        acumulado.cancelados += 1
      }

      return acumulado
    },
    { total: 0, pagos: 0, reservados: 0, expirados: 0, cancelados: 0, valorPago: 0 }
  )
}
