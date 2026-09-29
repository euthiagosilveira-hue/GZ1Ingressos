import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  decidirAcessoOperador,
  mensagemLoginErro,
  perfilPermitido
} from '../app/utils/auth.ts'

test('perfilPermitido aceita ADMINISTRADOR e PORTARIA', () => {
  assert.equal(perfilPermitido('ADMINISTRADOR'), true)
  assert.equal(perfilPermitido('PORTARIA'), true)
  assert.equal(perfilPermitido('FINANCEIRO'), false)
  assert.equal(perfilPermitido(null), false)
  assert.equal(perfilPermitido(undefined), false)
})

test('decidirAcessoOperador: sem sessao vai para login', () => {
  assert.equal(
    decidirAcessoOperador({ temSessao: false, perfil: null, ativo: null }),
    'IR_LOGIN'
  )
})

test('decidirAcessoOperador: sem usuario/perfil permitido nega', () => {
  assert.equal(
    decidirAcessoOperador({ temSessao: true, perfil: null, ativo: null }),
    'NEGAR'
  )
  assert.equal(
    decidirAcessoOperador({ temSessao: true, perfil: 'FINANCEIRO', ativo: true }),
    'NEGAR'
  )
})

test('decidirAcessoOperador: perfil permitido mas inativo nega', () => {
  assert.equal(
    decidirAcessoOperador({ temSessao: true, perfil: 'PORTARIA', ativo: false }),
    'NEGAR'
  )
})

test('decidirAcessoOperador: PORTARIA e ADMINISTRADOR ativos permitem', () => {
  assert.equal(
    decidirAcessoOperador({ temSessao: true, perfil: 'PORTARIA', ativo: true }),
    'PERMITIR'
  )
  assert.equal(
    decidirAcessoOperador({ temSessao: true, perfil: 'ADMINISTRADOR', ativo: true }),
    'PERMITIR'
  )
})

test('mensagemLoginErro nao expoe detalhes tecnicos', () => {
  assert.equal(mensagemLoginErro('CREDENCIAIS_INVALIDAS'), 'E-mail ou senha inválidos.')
  assert.equal(mensagemLoginErro('SEM_PERMISSAO'), 'Você não tem permissão para acessar a portaria.')
  assert.equal(mensagemLoginErro('ERRO_TEMPORARIO'), 'Não foi possível entrar agora. Tente novamente.')
})
