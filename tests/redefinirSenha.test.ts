import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  LINK_REDEFINICAO_INVALIDO_MSG,
  PEDIDO_REDEFINICAO_ENVIADO_MSG,
  urlRedefinicao
} from '../app/utils/redefinirSenha.ts'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

const pedido = ler('../app/pages/esqueci-senha.vue')
const redefinir = ler('../app/pages/auth/redefinir-senha.vue')

test('urlRedefinicao usa siteUrl e cai para a origem atual', () => {
  assert.equal(
    urlRedefinicao('https://gz-1-ingressos.vercel.app/', 'http://localhost:3000'),
    'https://gz-1-ingressos.vercel.app/auth/redefinir-senha'
  )
  assert.equal(urlRedefinicao('', 'http://localhost:3000'), 'http://localhost:3000/auth/redefinir-senha')
})

test('mensagem de envio e neutra (nao revela se o e-mail existe)', () => {
  assert.match(PEDIDO_REDEFINICAO_ENVIADO_MSG, /Se este e-mail estiver cadastrado/)
  assert.match(LINK_REDEFINICAO_INVALIDO_MSG, /expirou|utilizado/)
})

test('/esqueci-senha envia o link via Supabase Auth', () => {
  assert.ok(pedido.includes('resetPasswordForEmail'))
  assert.ok(pedido.includes('urlRedefinicao('))
  assert.ok(pedido.includes('PEDIDO_REDEFINICAO_ENVIADO_MSG'))
  assert.ok(pedido.includes('layout: false'))
  assert.ok(!pedido.includes('middleware'))
})

test('/auth/redefinir-senha troca a senha e exige perfil ativo', () => {
  assert.ok(redefinir.includes('exchangeCodeForSession'))
  assert.ok(redefinir.includes('setSession'))
  assert.ok(redefinir.includes('updateUser({ password: form.senha })'))
  assert.ok(redefinir.includes('validarSenhaConvite'))
  assert.ok(redefinir.includes('codigoErroPerfil'))
  assert.ok(redefinir.includes('signOut'))
  assert.ok(redefinir.includes('destinoAposConvite'))
  assert.ok(redefinir.includes('to="/esqueci-senha"'))
  assert.ok(!redefinir.includes('middleware'))
})
