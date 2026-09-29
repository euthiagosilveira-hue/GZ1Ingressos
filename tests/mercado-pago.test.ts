import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'

import {
  deveAutoAprovarPixTeste,
  deveConfirmarPagamento,
  deveIgnorarFalhaConfirmacao,
  mapMpOrderToCharge,
  mapMpStatus,
  montarPayloadOrderPix
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

function inputPix(autoApproveTestPix?: boolean) {
  return {
    amount: 40,
    externalReference: 'pay-1',
    payerEmail: 'test_user_br@testuser.com',
    expirationMinutes: 30,
    idempotencyKey: 'pay-1',
    autoApproveTestPix
  }
}

test('A) autoApproveTestPix=false/undefined nao envia first_name APRO', () => {
  assert.equal(montarPayloadOrderPix(inputPix(false)).payer.first_name, undefined)
  assert.equal(montarPayloadOrderPix(inputPix()).payer.first_name, undefined)
  assert.equal(montarPayloadOrderPix(inputPix(false)).payer.email, 'test_user_br@testuser.com')
})

test('B) autoApproveTestPix=true envia first_name=APRO', () => {
  const payload = montarPayloadOrderPix(inputPix(true))
  assert.equal(payload.payer.first_name, 'APRO')
  assert.equal(payload.payer.email, 'test_user_br@testuser.com')
  assert.equal(payload.total_amount, '40.00')
})

test('C) credencial de producao/nunca-teste nunca auto-aprova', () => {
  // credencial nao confirmada como teste => false mesmo com a flag ligada
  assert.equal(deveAutoAprovarPixTeste(true, false), false)
  assert.equal(deveAutoAprovarPixTeste(false, true), false)
  assert.equal(deveAutoAprovarPixTeste(false, false), false)
  assert.equal(deveAutoAprovarPixTeste(true, true), true)
  // e o payload so recebe APRO quando o resultado composto e verdadeiro
  const autoAprovar = deveAutoAprovarPixTeste(true, false)
  assert.equal(montarPayloadOrderPix(inputPix(autoAprovar)).payer.first_name, undefined)
})

test('A) provider nao-APROVADO nao chama confirmar_pagamento', () => {
  assert.equal(deveConfirmarPagamento('PENDENTE', 'PENDENTE'), false)
  assert.equal(deveConfirmarPagamento('EXPIRADO', 'PENDENTE'), false)
  assert.equal(deveConfirmarPagamento('REJEITADO', null), false)
  assert.equal(deveConfirmarPagamento('CANCELADO', 'PENDENTE'), false)
})

test('B) provider APROVADO + interno PENDENTE chama confirmar_pagamento', () => {
  assert.equal(deveConfirmarPagamento('APROVADO', 'PENDENTE'), true)
  assert.equal(deveConfirmarPagamento('APROVADO', null), true)
  assert.equal(deveConfirmarPagamento('APROVADO', undefined), true)
})

test('C) provider APROVADO + interno ja APROVADO e idempotente', () => {
  assert.equal(deveConfirmarPagamento('APROVADO', 'APROVADO'), false)
})

test('D) webhook e status concorrentes nao duplicam', () => {
  // 1a decisao confirma; apos confirmar o interno vira APROVADO e a 2a nao confirma.
  assert.equal(deveConfirmarPagamento('APROVADO', 'PENDENTE'), true)
  assert.equal(deveConfirmarPagamento('APROVADO', 'APROVADO'), false)
  // falha por corrida: se o interno ja esta APROVADO, ignora a falha
  assert.equal(deveIgnorarFalhaConfirmacao('APROVADO'), true)
})

test('E) falha na RPC de confirmacao vira erro controlado se nao aprovado', () => {
  assert.equal(deveIgnorarFalhaConfirmacao('PENDENTE'), false)
  assert.equal(deveIgnorarFalhaConfirmacao(null), false)
  assert.equal(deveIgnorarFalhaConfirmacao(undefined), false)
})
