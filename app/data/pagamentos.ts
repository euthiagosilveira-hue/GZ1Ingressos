import { buscarPedidoDetalhe } from '~/data/pedidoDetalhes'
import { pedidosMock } from '~/data/pedidos'
import type { FinancialPaymentStatus, PaymentListItem } from '~/types/pagamento'

let sequencia = 0

function proximoNumero(): string {
  sequencia += 1
  return String(sequencia).padStart(3, '0')
}

function somarMinutos(iso: string, minutos: number): string {
  return new Date(new Date(iso).getTime() + minutos * 60_000).toISOString()
}

function derivarPagamentos(): PaymentListItem[] {
  const pagamentos: PaymentListItem[] = []

  pedidosMock.forEach((pedido) => {
    const detalhe = buscarPedidoDetalhe(pedido.id)
    const pagamento = detalhe?.pagamento ?? null
    const status: FinancialPaymentStatus = pagamento?.status ?? 'PENDENTE'
    const numero = proximoNumero()

    pagamentos.push({
      id: `pay_mock_${numero}`,
      pedidoId: pedido.id,
      pedidoCodigo: pedido.codigo,
      eventoId: pedido.eventoId,
      eventoNome: pedido.eventoNome,
      compradorNome: pedido.compradorNome,
      provider: pagamento?.provider ?? 'STONE',
      valor: pedido.valorTotal,
      status,
      transactionId: `pay_mock_${numero}`,
      chargeId: `ch_mock_${numero}`,
      externalReference: `ref_${pedido.codigo}`,
      criadoEm: pedido.criadoEm,
      expiraEm: pagamento?.expiraEm ?? null,
      confirmadoEm: pagamento?.confirmadoEm ?? null,
      canceladoEm: pagamento?.canceladoEm ?? null,
      reembolsadoEm: pagamento?.reembolsadoEm ?? null,
      valorReembolsado: pagamento?.valorReembolsado ?? 0
    })
  })

  const tentativasRejeitadas = [0, 2, 5, 7, 9, 11, 13]
  const tentativasMercadoPago = [5, 11]

  tentativasRejeitadas.forEach((indice) => {
    const pedido = pedidosMock[indice]
    if (!pedido) return

    const numero = proximoNumero()

    pagamentos.push({
      id: `pay_mock_${numero}`,
      pedidoId: pedido.id,
      pedidoCodigo: pedido.codigo,
      eventoId: pedido.eventoId,
      eventoNome: pedido.eventoNome,
      compradorNome: pedido.compradorNome,
      provider: tentativasMercadoPago.includes(indice) ? 'MERCADO_PAGO' : 'STONE',
      valor: pedido.valorTotal,
      status: 'REJEITADO',
      transactionId: `pay_mock_${numero}`,
      chargeId: `ch_mock_${numero}`,
      externalReference: `ref_${pedido.codigo}`,
      criadoEm: somarMinutos(pedido.criadoEm, -20),
      expiraEm: null,
      confirmadoEm: null,
      canceladoEm: null,
      reembolsadoEm: null,
      valorReembolsado: 0
    })
  })

  return pagamentos
}

export const pagamentosMock: PaymentListItem[] = derivarPagamentos()
