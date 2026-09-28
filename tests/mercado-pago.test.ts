import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import {
  mapMpOrderToCharge,
  mapMpStatus
} from '../server/services/payments/mercado-pago/mercado-pago-mapper.ts'
import {
  montarManifest,
  validarAssinaturaMp
} from '../server/services/payments/mercado-pago/mercado-pago-signature.ts'

test('mapMpStatus mapeia estados principais', () => {
  assert.equal(mapMpStatus('processed', 'accredited'), 'APROVADO')
  assert.equal(mapMpStatus('action_required', 'waiting_transfer'), 'PENDENTE')
  assert.equal(mapMpStatus('action_required', 'waiting_payment'), 'PENDENTE')
  assert.equal(mapMpStatus('expired', 'expired'), 'EXPIRADO')
  assert.equal(mapMpStatus('canceled', 'canceled'), 'CANCELADO')
  assert.equal(mapMpStatus('failed', 'high_risk'), 'REJEITADO')
  assert.equal(mapMpStatus('refunded', 'refunded'), 'REEMBOLSADO')
  assert.equal(mapMpStatus('processed', 'partially_refunded'), 'REEMBOLSADO')
})

test('mapMpOrderToCharge normaliza order Pix', () => {
  const charge = mapMpOrderToCharge({
    id: 'ORD123',
    status: 'action_required',
    status_detail: 'waiting_transfer',
    external_reference: 'pay-1',
    transactions: {
      payments: [
        {
          id: 'PAY1',
          status: 'action_required',
          status_detail: 'waiting_transfer',
          payment_method: { id: 'pix', type: 'bank_transfer', qr_code: 'EMV', qr_code_base64: 'B64' }
        }
      ]
    }
  })

  assert.equal(charge.provider, 'MERCADO_PAGO')
  assert.equal(charge.chargeId, 'ORD123')
  assert.equal(charge.transactionId, 'PAY1')
  assert.equal(charge.externalReference, 'pay-1')
  assert.equal(charge.pixCopyPaste, 'EMV')
  assert.equal(charge.pixQrCode, 'B64')
  assert.equal(charge.status, 'PENDENTE')
})

test('montarManifest segue o formato oficial e omite ausentes', () => {
  assert.equal(
    montarManifest({ xSignature: 'ts=123,v1=abc', xRequestId: 'req-1', dataId: 'ORD01ABC' }),
    'id:ord01abc;request-id:req-1;ts:123;'
  )
  assert.equal(
    montarManifest({ xSignature: 'ts=9,v1=x', xRequestId: null, dataId: 'AB' }),
    'id:ab;ts:9;'
  )
  assert.equal(montarManifest({ xSignature: null, xRequestId: null, dataId: 'AB' }), null)
})

test('validarAssinaturaMp aceita assinatura correta e rejeita invalida', () => {
  const secret = 'segredo-de-teste'
  const xRequestId = 'req-123'
  const dataId = 'ord01abc'
  const ts = '1742505638683'
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const v1 = createHmac('sha256', secret).update(manifest).digest('hex')
  const header = `ts=${ts},v1=${v1}`

  assert.equal(validarAssinaturaMp({ xSignature: header, xRequestId, dataId }, secret), true)
  assert.equal(validarAssinaturaMp({ xSignature: header, xRequestId, dataId }, 'outro-segredo'), false)
  assert.equal(validarAssinaturaMp({ xSignature: 'ts=1,v1=deadbeef', xRequestId, dataId }, secret), false)
  assert.equal(validarAssinaturaMp({ xSignature: header, xRequestId, dataId }, ''), false)
})
