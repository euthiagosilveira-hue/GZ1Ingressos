import { test } from 'node:test'
import assert from 'node:assert/strict'

import { montarLinkWhatsApp, montarShareData } from '../app/utils/share.ts'

test('montarShareData monta titulo/texto sem expor token', () => {
  const data = montarShareData({
    url: 'https://gz1.example/ingresso/abc123',
    eventoNome: 'Evento Teste'
  })
  assert.equal(data.title, 'GZ1 Ingresso')
  assert.equal(data.text, 'Seu ingresso para Evento Teste')
  assert.equal(data.url, 'https://gz1.example/ingresso/abc123')
})

test('montarLinkWhatsApp usa telefone com 55 e mensagem com link', () => {
  const link = montarLinkWhatsApp({
    url: 'https://gz1.example/ingresso/abc',
    eventoNome: 'Samba',
    participanteNome: 'Maria',
    telefone: '(34) 99177-2553'
  })
  assert.ok(link.startsWith('https://wa.me/5534991772553?text='))
  const texto = decodeURIComponent(link.split('?text=')[1])
  assert.equal(texto, 'Olá, Maria! Aqui está seu ingresso para Samba. Apresente o QR Code na entrada: https://gz1.example/ingresso/abc')
})

test('montarLinkWhatsApp sem telefone valido deixa escolher o contato', () => {
  assert.ok(montarLinkWhatsApp({ url: 'u', eventoNome: 'E', telefone: null }).startsWith('https://wa.me/?text='))
  assert.ok(montarLinkWhatsApp({ url: 'u', eventoNome: 'E', telefone: '123' }).startsWith('https://wa.me/?text='))
  assert.ok(montarLinkWhatsApp({ url: 'u', eventoNome: 'E', telefone: '5534991772553' }).startsWith('https://wa.me/5534991772553?'))
})
