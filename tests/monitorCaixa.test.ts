import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  type DadosResumoCaixa,
  corpoPedidoResumo,
  interpretarResumo,
  notificacaoAvisos,
  notificacaoResumo,
  resumoSemIa,
  ultimaSemanaFechada
} from '../server/utils/resumo-caixa.ts'
import { lerDiaVencimento, mapearCategoria } from '../app/utils/caixa.ts'

const dados: DadosResumoCaixa = {
  periodo: { de: '2026-11-09', ate: '2026-11-15', dias: 7 },
  entradas: 20000,
  saidas: 8000.5,
  entradas_anterior: 15000,
  saidas_anterior: 7000,
  bar: 16299.7,
  bar_anterior: 19000,
  ingressos: 3700,
  ingressos_anterior: 0,
  por_categoria: [],
  maiores_saidas: [{ valor: 3000, data: '2026-11-12', categoria: 'Compras do bar', descricao: 'Ambev' }],
  eventos: [],
  saldos: [{ conta: 'Itaú', saldo: 9633.22 }],
  saldo_total: 9633.22,
  contas_fixas_proximos_7_dias: [{ nome: 'Aluguel', vencimento: '2026-11-18' }],
  avisos_na_semana: ['Falta o Fechar bar: Samba']
}

test('ultima semana fechada: segunda pega a semana que terminou ontem', () => {
  assert.deepEqual(ultimaSemanaFechada('2026-11-16'), { de: '2026-11-09', ate: '2026-11-15' })
})

test('ultima semana fechada: no meio da semana e no domingo', () => {
  assert.deepEqual(ultimaSemanaFechada('2026-11-19'), { de: '2026-11-09', ate: '2026-11-15' })
  assert.deepEqual(ultimaSemanaFechada('2026-11-22'), { de: '2026-11-09', ate: '2026-11-15' })
  assert.deepEqual(ultimaSemanaFechada('2026-12-01'), { de: '2026-11-23', ate: '2026-11-29' })
})

test('pedido para a IA leva os numeros e pede JSON', () => {
  const corpo = corpoPedidoResumo(dados) as { contents: { parts: { text: string }[] }[]; generationConfig: { responseMimeType: string } }
  assert.equal(corpo.generationConfig.responseMimeType, 'application/json')
  assert.match(corpo.contents[0]!.parts[0]!.text, /16299\.7/)
  assert.match(corpo.contents[0]!.parts[0]!.text, /Não invente/)
})

test('interpreta a resposta da IA e recusa resposta quebrada', () => {
  assert.deepEqual(interpretarResumo('{"manchete":" Semana boa ","texto":"• Bar caiu 14%"}'), {
    manchete: 'Semana boa',
    texto: '• Bar caiu 14%'
  })
  assert.equal(interpretarResumo('nada'), null)
  assert.equal(interpretarResumo('{"manchete":""}'), null)
})

test('resumo sem IA usa os numeros do banco', () => {
  const r = resumoSemIa(dados)
  assert.match(r.manchete, /R\$\s20\.000,00/)
  assert.match(r.texto, /sobrou R\$\s11\.999,50/)
  assert.match(r.texto, /Bar: R\$\s16\.299,70 \(caiu 14%/)
  assert.match(r.texto, /Ingressos: R\$\s3\.700,00\./)
  assert.match(r.texto, /Aluguel \(18\/11\)/)
  assert.match(r.texto, /1 aviso do caixa/)
})

test('notificacao: um aviso, varios avisos e nenhum', () => {
  assert.equal(notificacaoAvisos([]), null)
  const um = notificacaoAvisos([{ id: 'a', tipo: 'CONTA_FIXA', titulo: 'Aluguel vence amanhã', mensagem: 'm' }])
  assert.equal(um?.title, '⚠️ Aluguel vence amanhã')
  assert.equal(um?.url, '/financeiro')
  const varios = notificacaoAvisos(
    ['1', '2', '3', '4', '5', '6'].map((id) => ({ id, tipo: 'DUPLICADO', titulo: `Aviso ${id}`, mensagem: '' }))
  )
  assert.equal(varios?.title, '⚠️ 6 avisos do caixa')
  assert.match(varios!.body, /e mais 2/)
  assert.match(notificacaoResumo('2026-11-09', '2026-11-15', 'Oi').title, /09\/11 a 15\/11/)
})

test('dia de vencimento da conta fixa', () => {
  assert.equal(lerDiaVencimento(''), null)
  assert.equal(lerDiaVencimento(' 10 '), 10)
  assert.equal(lerDiaVencimento('31'), 31)
  assert.equal(lerDiaVencimento('0'), undefined)
  assert.equal(lerDiaVencimento('32'), undefined)
  assert.equal(lerDiaVencimento('dez'), undefined)
  assert.equal(mapearCategoria({ id: 'x', nome: 'Aluguel', tipo: 'SAIDA', dia_vencimento: 10 }).diaVencimento, 10)
  assert.equal(mapearCategoria({ id: 'x', nome: 'Bar', tipo: 'ENTRADA', dia_vencimento: null }).diaVencimento, null)
})
