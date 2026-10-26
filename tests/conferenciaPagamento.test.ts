import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { INTERVALO_CONFERENCIA_MS, ingressosParaConferir } from '../app/utils/portariaBusca.ts'
import type { IngressoBuscaNome } from '../app/types/gate.ts'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

function item(parcial: Partial<IngressoBuscaNome>): IngressoBuscaNome {
  return {
    origem: 'INGRESSO',
    ingressoId: 'a',
    vipId: null,
    codigo: 'GZ1-01',
    participanteNome: 'Ana',
    status: 'EXPIRADO',
    utilizadoEm: null,
    entradaEm: null,
    telefone: null,
    semelhante: false,
    ...parcial
  }
}

test('confere so ingressos EXPIRADOS (nao VIP, com id)', () => {
  const ids = ingressosParaConferir(
    [
      item({ ingressoId: 'a' }),
      item({ ingressoId: 'b', status: 'VALIDO' }),
      item({ ingressoId: null }),
      item({ origem: 'VIP', ingressoId: null, vipId: 'v', status: 'EXPIRADO' })
    ],
    new Map(),
    1_000_000
  )
  assert.deepEqual(ids, ['a'])
})

test('nao repete a conferencia do mesmo ingresso dentro do intervalo', () => {
  const agora = 1_000_000
  const conferidos = new Map([['a', agora - 1000]])
  assert.deepEqual(ingressosParaConferir([item({ ingressoId: 'a' })], conferidos, agora), [])
  assert.deepEqual(
    ingressosParaConferir([item({ ingressoId: 'a' })], conferidos, agora + INTERVALO_CONFERENCIA_MS),
    ['a']
  )
})

test('limita a 20 ingressos por conferencia', () => {
  const itens = Array.from({ length: 30 }, (_, i) => item({ ingressoId: `id${i}` }))
  assert.equal(ingressosParaConferir(itens, new Map(), 0).length, 20)
})

test('busca por nome confere expirados e mostra aviso na portaria', () => {
  const composable = ler('../app/composables/useGateNameSearch.ts')
  assert.match(composable, /conferirExpirados\(encontrados, minhaBusca\)/)
  const painel = ler('../app/components/portaria/GateNameSearchPanel.vue')
  assert.match(painel, /Verificando Pix\.\.\./)
  const endpoint = ler('../server/api/portaria/conferir-pagamentos.post.ts')
  assert.match(endpoint, /exigirEquipe/)
})
