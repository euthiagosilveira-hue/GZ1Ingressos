import { serverSupabaseServiceRole } from '#supabase/server'
import type { H3Event } from 'h3'

import { ehUuid } from '../../services/payments/payment-service'
import { MercadoPagoProvider } from '../../services/payments/mercado-pago/mercado-pago-provider'
import { validarAssinaturaMp } from '../../services/payments/mercado-pago/mercado-pago-signature'
import { notificarVendaConfirmada } from '../../services/push/push-service'

interface Registro {
  resultado: string
  status: number
  tipo: string | null
  dataId: string | null
  assinaturaPresente: boolean
  statusMp?: string
  pagamentoId?: string | null
  detalhe?: string
}

/**
 * Registra cada chamada do webhook na auditoria (acao WEBHOOK_MP), para que
 * seja possivel ver pelo banco se o Mercado Pago esta chamando e por que
 * uma chamada falhou. Nunca derruba o webhook se o registro falhar.
 */
async function registrar(event: H3Event, r: Registro) {
  if (r.status >= 400) console.error('[webhook-mp]', JSON.stringify(r))
  try {
    const client = serverSupabaseServiceRole(event)
    await client.from('auditoria').insert({
      acao: 'WEBHOOK_MP',
      entidade: 'pagamentos',
      entidade_id: r.pagamentoId && ehUuid(r.pagamentoId) ? r.pagamentoId : null,
      dados_novos: {
        resultado: r.resultado,
        http: r.status,
        tipo: r.tipo,
        data_id: r.dataId?.slice(0, 64) ?? null,
        assinatura_presente: r.assinaturaPresente,
        status_mp: r.statusMp ?? null,
        detalhe: r.detalhe?.slice(0, 300) ?? null
      }
    })
  } catch (e) {
    console.error('[webhook-mp] falha ao registrar auditoria', e)
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const secret = config.mercadoPagoWebhookSecret
  const accessToken = config.mercadoPagoAccessToken

  const query = getQuery(event)
  const body = await readBody<{ data?: { id?: string }; type?: string }>(event).catch(() => ({}))
  const dataId = String(query['data.id'] ?? body?.data?.id ?? '') || null
  const tipo = String(query.type ?? query.topic ?? body?.type ?? '') || null

  const xSignature = getHeader(event, 'x-signature') ?? null
  const xRequestId = getHeader(event, 'x-request-id') ?? null
  const base = { tipo, dataId, assinaturaPresente: !!xSignature }

  const responder = async (status: number, resultado: string, extra: Partial<Registro> = {}) => {
    await registrar(event, { ...base, ...extra, resultado, status })
    setResponseStatus(event, status)
    return status < 400 ? { ok: true } : { error: resultado }
  }

  if (!secret) return responder(500, 'WEBHOOK_NAO_CONFIGURADO')

  const assinaturaValida = validarAssinaturaMp({ xSignature, xRequestId, dataId }, secret)
  if (!assinaturaValida) return responder(401, 'ASSINATURA_INVALIDA')

  if (!dataId) return responder(400, 'DATA_ID_AUSENTE')

  if (!accessToken) return responder(503, 'PAGAMENTO_INDISPONIVEL')

  // Nunca confiar apenas no payload: sempre consultar a Order oficial.
  let charge
  try {
    const provider = new MercadoPagoProvider(accessToken)
    charge = await provider.getCharge(dataId)
  } catch (e) {
    return responder(502, 'ERRO_CONSULTA_MP', { detalhe: e instanceof Error ? e.message : String(e) })
  }

  const extra = { statusMp: charge.status, pagamentoId: charge.externalReference }

  if (charge.status !== 'APROVADO' || !ehUuid(charge.externalReference)) {
    return responder(200, 'IGNORADO', extra)
  }

  const client = serverSupabaseServiceRole(event)
  const { data, error } = await client.rpc('confirmar_pagamento', {
    p_pagamento_id: charge.externalReference,
    p_transaction_id: charge.transactionId,
    p_referencia_externa: charge.externalReference
  })
  if (error) return responder(500, 'ERRO_CONFIRMACAO', { ...extra, detalhe: error.message })

  // So a primeira confirmacao notifica (reenvios do webhook voltam 'ja_confirmado').
  const resultado = data as { resultado?: string; pedido_id?: string } | null
  if (resultado?.resultado === 'confirmado' && resultado.pedido_id) {
    await notificarVendaConfirmada(event, resultado.pedido_id)
  }

  return responder(200, String(resultado?.resultado ?? 'OK').toUpperCase(), extra)
})
