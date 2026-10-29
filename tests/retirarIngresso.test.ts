import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { PUBLIC_NAV_ITEMS } from '../app/utils/publicNav.ts'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

const cardPix = ler('../app/components/public/pagamento/PaymentPendingCard.vue')
const composable = ler('../app/composables/usePublicPayment.ts')
const paginaPagamento = ler('../app/components/public/pagamento/PublicPaymentPage.vue')
const paginaIngressos = ler('../app/components/public/ingressos/PublicTicketsPage.vue')
const header = ler('../app/components/public/PublicHeader.vue')

test('tela do Pix explica que o ingresso aparece ao voltar', () => {
  assert.ok(cardPix.includes('Como receber seu ingresso'))
  assert.ok(cardPix.includes('Volte para esta página:'))
  assert.ok(cardPix.includes('v-if="jaCopiou"'))
  assert.ok(cardPix.includes('to="/recuperar-ingressos"'))
})

test('ao voltar do banco confere o pagamento na hora', () => {
  assert.ok(composable.includes("addEventListener('visibilitychange', aoVoltarParaTela)"))
  assert.ok(composable.includes("removeEventListener('visibilitychange', aoVoltarParaTela)"))
  assert.ok(composable.includes("addEventListener('pageshow', aoReabrirPagina)"))
})

test('pagamento confirmado abre os ingressos sozinho', () => {
  assert.ok(paginaPagamento.includes('/comprar/ingressos?token='))
  assert.ok(paginaPagamento.includes('replace: true'))
})

test('"Meus ingressos" aparece em destaque no topo', () => {
  const item = PUBLIC_NAV_ITEMS.find((i) => i.label === 'Meus ingressos')
  assert.equal(item?.destaque, true)
  assert.ok(header.includes('item.destaque'))
})

test('tela do ingresso oferece enviar o link para o proprio WhatsApp', () => {
  assert.ok(paginaIngressos.includes('Enviar para meu WhatsApp'))
  assert.ok(paginaIngressos.includes('/meus-ingressos?token='))
  // Sem link de recuperacao (expira): so com o checkout_token.
  assert.ok(paginaIngressos.includes('if (!token.value || !tickets.value) return null'))
})
