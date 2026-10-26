import type { H3Event } from 'h3'

import { MercadoPagoProvider } from '../services/payments/mercado-pago/mercado-pago-provider'
import type { exigirAdmin } from './admin-auth'

type ClienteAdmin = Awaited<ReturnType<typeof exigirAdmin>>

export type SituacaoMercadoPago = 'PAGO' | 'NAO_PAGO' | 'SEM_PIX' | 'ERRO_CONSULTA'

export interface PedidoExpiradoConferido {
  pedidoId: string
  pagamentoId: string | null
  codigo: string
  compradorNome: string
  quantidade: number
  valorTotal: number
  criadoEm: string
  situacao: SituacaoMercadoPago
}

interface PedidoExpiradoBanco {
  id: string
  codigo: string
  comprador_nome: string
  quantidade: number
  valor_total: number | string
  criado_em: string
  pagamentos:
    | { id: string; provedor: string; cobranca_id: string | null }
    | { id: string; provedor: string; cobranca_id: string | null }[]
    | null
}

const CONSULTAS_SIMULTANEAS = 5

function primeiroPagamento(pedido: PedidoExpiradoBanco) {
  const pg = pedido.pagamentos
  if (!pg) return null
  return Array.isArray(pg) ? (pg[0] ?? null) : pg
}

/**
 * Pergunta ao Mercado Pago, pedido por pedido, se os pedidos EXPIRADOS do
 * evento foram pagos. Somente leitura: nao altera nada no banco.
 * So considera PAGO quando a Order esta aprovada E aponta para o mesmo
 * pagamento interno (external_reference).
 */
export async function conferirPedidosExpirados(
  admin: ClienteAdmin,
  eventoId: string,
  accessToken: string
): Promise<PedidoExpiradoConferido[]> {
  const { data, error } = await admin
    .from('pedidos')
    .select('id,codigo,comprador_nome,quantidade,valor_total,criado_em,pagamentos(id,provedor,cobranca_id)')
    .eq('evento_id', eventoId)
    .eq('status', 'EXPIRADO')
    .order('criado_em')
    .limit(2000)
  if (error) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })

  const pedidos = (data ?? []) as unknown as PedidoExpiradoBanco[]
  const provider = new MercadoPagoProvider(accessToken)

  async function conferir(pedido: PedidoExpiradoBanco): Promise<PedidoExpiradoConferido> {
    const pagamento = primeiroPagamento(pedido)
    const base = {
      pedidoId: pedido.id,
      pagamentoId: pagamento?.id ?? null,
      codigo: pedido.codigo,
      compradorNome: pedido.comprador_nome,
      quantidade: pedido.quantidade,
      valorTotal: Number(pedido.valor_total),
      criadoEm: pedido.criado_em
    }
    if (!pagamento || pagamento.provedor !== 'MERCADO_PAGO' || !pagamento.cobranca_id) {
      return { ...base, situacao: 'SEM_PIX' }
    }
    try {
      const charge = await provider.getCharge(pagamento.cobranca_id)
      const pago = charge.status === 'APROVADO' && charge.externalReference === pagamento.id
      return { ...base, situacao: pago ? 'PAGO' : 'NAO_PAGO' }
    } catch {
      return { ...base, situacao: 'ERRO_CONSULTA' }
    }
  }

  const resultado: PedidoExpiradoConferido[] = []
  for (let i = 0; i < pedidos.length; i += CONSULTAS_SIMULTANEAS) {
    resultado.push(...(await Promise.all(pedidos.slice(i, i + CONSULTAS_SIMULTANEAS).map(conferir))))
  }
  return resultado
}

/**
 * Libera os pedidos que o Mercado Pago confirmou como pagos: o pedido volta a
 * PAGO e os ingressos a VALIDO (confirmar_pagamento aceita pagamento tardio).
 * Nao dispara push de venda: e uma correcao feita pelo proprio admin.
 */
export async function liberarPedidosPagos(
  admin: ClienteAdmin,
  conferidos: PedidoExpiradoConferido[]
): Promise<{ liberados: string[]; falhas: string[] }> {
  const liberados: string[] = []
  const falhas: string[] = []

  for (const pedido of conferidos) {
    if (pedido.situacao !== 'PAGO' || !pedido.pagamentoId) continue
    const { error } = await admin.rpc('confirmar_pagamento', {
      p_pagamento_id: pedido.pagamentoId,
      p_transaction_id: null,
      p_referencia_externa: pedido.pagamentoId
    })
    if (error) {
      falhas.push(pedido.codigo)
      continue
    }
    liberados.push(pedido.codigo)
  }

  return { liberados, falhas }
}

export function lerEventoIdDaRota(event: H3Event): string {
  const id = String(getRouterParam(event, 'id') ?? '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'DADOS_INVALIDOS' })
  }
  return id
}
