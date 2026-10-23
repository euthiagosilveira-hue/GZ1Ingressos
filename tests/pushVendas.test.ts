import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  inscricaoExpirada,
  montarNotificacaoVenda,
  validarInscricao
} from '../server/services/push/push-mensagem.ts'
import { chaveVapidParaBytes } from '../app/utils/push.ts'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

test('notificacao de venda mostra quantidade, valor, evento e primeiro nome', () => {
  const n = montarNotificacaoVenda(
    { evento: 'Festa GZ1', quantidade: 2, valorTotal: 120, comprador: 'Maria da Silva' },
    'abc'
  )
  assert.equal(n.title, 'Nova venda! 🎟️')
  assert.match(n.body, /^2 ingressos · R\$\s?120,00\nFesta GZ1 · Maria$/)
  assert.equal(n.url, '/pedidos')
  assert.equal(n.tag, 'venda-abc')
  assert.match(montarNotificacaoVenda({ evento: 'X', quantidade: 1, valorTotal: 50, comprador: '' }).body, /^1 ingresso ·/)
})

test('inscricao expirada (404/410) e removida', () => {
  assert.ok(inscricaoExpirada(410))
  assert.ok(inscricaoExpirada(404))
  assert.ok(!inscricaoExpirada(500))
  assert.ok(!inscricaoExpirada(undefined))
})

test('validarInscricao aceita PushSubscription.toJSON e rejeita lixo', () => {
  assert.deepEqual(
    validarInscricao({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'p', auth: 'a' } }),
    { endpoint: 'https://fcm.googleapis.com/x', p256dh: 'p', auth: 'a' }
  )
  assert.equal(validarInscricao({ endpoint: 'http://x', keys: { p256dh: 'p', auth: 'a' } }), null)
  assert.equal(validarInscricao({ endpoint: 'https://x' }), null)
  assert.equal(validarInscricao(null), null)
})

test('chave VAPID base64url vira 65 bytes', () => {
  const chave = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U'
  assert.equal(chaveVapidParaBytes(chave).length, 65)
})

test('so a primeira confirmacao do pagamento dispara a notificacao', () => {
  const webhook = ler('../server/api/webhooks/mercadopago.post.ts')
  const servico = ler('../server/services/payments/payment-service.ts')
  for (const fonte of [webhook, servico]) {
    assert.ok(fonte.includes('notificarVendaConfirmada('))
    assert.ok(fonte.includes("=== 'confirmado'"))
  }
})

test('push so vai para ADMINISTRADOR ativo e a tabela fica fechada ao cliente', () => {
  const servico = ler('../server/services/push/push-service.ts')
  assert.ok(servico.includes(".eq('usuarios.perfil', 'ADMINISTRADOR')"))
  assert.ok(servico.includes(".eq('usuarios.ativo', true)"))
  const migration = ler('../supabase/migrations/20261023020000_notificacoes_push.sql')
  assert.match(migration, /enable row level security/)
  assert.match(migration, /revoke all on table public\.push_inscricoes from public, anon, authenticated/)
})

test('service worker mostra a notificacao e abre o painel ao tocar', () => {
  const sw = ler('../public/sw.js')
  assert.ok(sw.includes("addEventListener('push'"))
  assert.ok(sw.includes('showNotification('))
  assert.ok(sw.includes("addEventListener('notificationclick'"))
})
