import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  corpoPedidoGemini,
  interpretarLeitura,
  leituraVazia,
  promptComprovante,
  textoRespostaGemini,
  urlGemini
} from '../server/utils/leitura-comprovante.ts'
import { mensagemErroLeituraIa } from '../app/utils/caixa.ts'

const categorias = [
  { id: 'c1', nome: 'Energia (CEMIG)' },
  { id: 'c2', nome: 'Cachê de banda' },
  { id: 'c3', nome: 'Aluguel' }
]
const hoje = '2026-11-11'

test('interpreta resposta completa do Gemini', () => {
  const r = interpretarLeitura(
    JSON.stringify({ valor: 412.37, data: '2026-11-05', descricao: '  CEMIG -  conta de luz ', categoria: 'Energia (CEMIG)' }),
    categorias,
    hoje
  )
  assert.deepEqual(r, { valor: 412.37, data: '2026-11-05', descricao: 'CEMIG - conta de luz', categoriaId: 'c1' })
})

test('aceita valor e data em formato brasileiro e categoria sem acento/caixa', () => {
  const r = interpretarLeitura(
    '```json\n{"valor":"R$ 1.234,50","data":"03/11/2026","descricao":"","categoria":"cache de banda"}\n```',
    categorias,
    hoje
  )
  assert.equal(r.valor, 1234.5)
  assert.equal(r.data, '2026-11-03')
  assert.equal(r.descricao, null)
  assert.equal(r.categoriaId, 'c2')
})

test('descarta categoria inventada, data impossivel e valor negativo', () => {
  const r = interpretarLeitura(
    JSON.stringify({ valor: -10, data: '2026-02-30', categoria: 'Marketing' }),
    categorias,
    hoje
  )
  assert.equal(r.valor, null)
  assert.equal(r.data, null)
  assert.equal(r.categoriaId, null)
  assert.ok(leituraVazia(r))
})

test('descarta data muito no futuro ou antiga', () => {
  assert.equal(interpretarLeitura('{"data":"2031-01-01"}', categorias, hoje).data, null)
  assert.equal(interpretarLeitura('{"data":"1999-12-31"}', categorias, hoje).data, null)
  assert.equal(interpretarLeitura('{"data":"2026-12-10"}', categorias, hoje).data, '2026-12-10')
})

test('resposta invalida vira leitura vazia', () => {
  assert.ok(leituraVazia(interpretarLeitura('nao sei', categorias, hoje)))
  assert.ok(leituraVazia(interpretarLeitura('[1,2]', categorias, hoje)))
})

test('extrai texto ignorando partes de pensamento', () => {
  const texto = textoRespostaGemini({
    candidates: [{ content: { parts: [{ text: 'pensando', thought: true }, { text: '{"valor":1}' }] } }]
  })
  assert.equal(texto, '{"valor":1}')
  assert.equal(textoRespostaGemini({}), '')
})

test('monta pedido com arquivo, prompt e saida JSON', () => {
  const prompt = promptComprovante('SAIDA', categorias, hoje)
  assert.match(prompt, /- Aluguel/)
  assert.match(prompt, /2026-11-11/)
  const corpo = corpoPedidoGemini({ base64: 'QUJD', mimeType: 'image/jpeg', prompt }) as {
    contents: { parts: Record<string, unknown>[] }[]
    generationConfig: { responseMimeType: string }
  }
  assert.deepEqual(corpo.contents[0]!.parts[0], { inline_data: { mime_type: 'image/jpeg', data: 'QUJD' } })
  assert.equal(corpo.generationConfig.responseMimeType, 'application/json')
  assert.equal(
    urlGemini('gemini-3.5-flash'),
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent'
  )
})

test('mensagens de erro da leitura por IA', () => {
  assert.match(mensagemErroLeituraIa({ data: { statusMessage: 'IA_NAO_CONFIGURADA' } }), /chave do Gemini/)
  assert.match(mensagemErroLeituraIa({ statusMessage: 'LIMITE_IA' }), /Limite gratuito/)
  assert.match(mensagemErroLeituraIa(new Error('x')), /Preencha à mão/)
})
