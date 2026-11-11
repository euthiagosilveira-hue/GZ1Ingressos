import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  agrupamentoSugerido,
  formatarDataCurta,
  hojeIso,
  intervaloPreset,
  lerValorReais,
  linhasPlanilhaFluxo,
  linhasPlanilhaLancamentos,
  mapearConta,
  mapearFluxo,
  mapearLancamento,
  mensagemErroCaixa,
  podeEditar,
  rotuloPeriodo,
  validarLancamento,
  valorComSinal
} from '../app/utils/caixa.ts'
import { gerarPlanilhaXlsx, planilhaXml } from '../app/utils/planilhaXlsx.ts'

test('lerValorReais entende o jeito brasileiro de digitar', () => {
  assert.equal(lerValorReais('1.234,56'), 1234.56)
  assert.equal(lerValorReais('1234,5'), 1234.5)
  assert.equal(lerValorReais('R$ 50'), 50)
  assert.equal(lerValorReais('50.25'), 50.25)
  assert.equal(lerValorReais('1.500'), 1500)
  assert.equal(lerValorReais('0'), 0)
  assert.equal(lerValorReais('-20,00'), -20)
  assert.equal(lerValorReais(''), null)
  assert.equal(lerValorReais('abc'), null)
  assert.equal(lerValorReais(12.345), 12.35)
})

test('hojeIso usa o horario de Brasilia', () => {
  // 02:00 UTC de 05/11 = 23:00 de 04/11 em Brasilia.
  assert.equal(hojeIso(new Date('2026-11-05T02:00:00Z')), '2026-11-04')
  assert.equal(hojeIso(new Date('2026-11-05T15:00:00Z')), '2026-11-05')
})

test('intervaloPreset calcula os periodos', () => {
  assert.deepEqual(intervaloPreset('HOJE', '2026-11-11'), { de: '2026-11-11', ate: '2026-11-11' })
  assert.deepEqual(intervaloPreset('SETE_DIAS', '2026-11-11'), { de: '2026-11-05', ate: '2026-11-11' })
  assert.deepEqual(intervaloPreset('ESTE_MES', '2026-11-11'), { de: '2026-11-01', ate: '2026-11-11' })
  assert.deepEqual(intervaloPreset('MES_PASSADO', '2026-03-31'), { de: '2026-02-01', ate: '2026-02-28' })
  assert.deepEqual(intervaloPreset('MES_PASSADO', '2026-01-15'), { de: '2025-12-01', ate: '2025-12-31' })
  assert.deepEqual(intervaloPreset('ESTE_ANO', '2026-11-11'), { de: '2026-01-01', ate: '2026-11-11' })
  assert.deepEqual(intervaloPreset('TUDO', '2026-11-11'), { de: null, ate: null })
})

test('datas e rotulos de periodo', () => {
  assert.equal(formatarDataCurta('2026-11-05'), '05/11/2026')
  assert.equal(rotuloPeriodo({ inicio: '2026-11-05' }, 'dia'), '05/11')
  assert.equal(rotuloPeriodo({ inicio: '2026-11-02' }, 'semana'), 'sem. 02/11')
  assert.equal(rotuloPeriodo({ inicio: '2026-11-01' }, 'mes'), 'nov/26')
  assert.equal(agrupamentoSugerido('2026-11-01', '2026-11-30'), 'dia')
  assert.equal(agrupamentoSugerido('2026-08-01', '2026-11-30'), 'semana')
  assert.equal(agrupamentoSugerido('2026-01-01', '2026-11-30'), 'mes')
})

test('mapearConta e mapearLancamento convertem a resposta da RPC', () => {
  const conta = mapearConta({
    id: 'c1', nome: 'Itaú', tipo: 'BANCO', provedor_ingressos: null,
    saldo_inicial: '1000.00', saldo_inicial_em: '2026-11-11T10:00:00Z',
    configurada: true, ativa: true, saldo_atual: '1250.50'
  })
  assert.equal(conta.saldoAtual, 1250.5)
  assert.equal(conta.configurada, true)

  const l = mapearLancamento({
    id: 'L:1', origem: 'MANUAL', lancamento_id: '1', tipo: 'SAIDA', data: '2026-11-11',
    valor: '500.00', categoria_nome: 'Aluguel', conta_nome: 'Itaú'
  })
  assert.equal(l.valor, 500)
  assert.equal(valorComSinal(l), -500)
  assert.equal(podeEditar(l), true)

  const auto = mapearLancamento({ id: 'P:1', origem: 'INGRESSO', tipo: 'ENTRADA', valor: 50, pedido_id: 'p1' })
  assert.equal(podeEditar(auto), false)
  assert.equal(valorComSinal(auto), 50)

  const cancelado = mapearLancamento({ ...l, id: 'L:2', origem: 'MANUAL', lancamento_id: '2', cancelado_em: '2026-11-11' })
  assert.equal(podeEditar(cancelado), false)
})

test('validarLancamento confere os campos obrigatorios', () => {
  const base = {
    tipo: 'SAIDA' as const, data: '2026-11-11', valor: '100,00', descricao: '',
    categoriaId: 'cat', contaId: 'c1', contaDestinoId: '', eventoId: ''
  }
  assert.deepEqual(validarLancamento(base), {})
  assert.ok(validarLancamento({ ...base, valor: '0' }).valor)
  assert.ok(validarLancamento({ ...base, categoriaId: '' }).categoriaId)
  assert.ok(validarLancamento({ ...base, tipo: 'TRANSFERENCIA', categoriaId: '' }).contaDestinoId)
  assert.ok(validarLancamento({ ...base, tipo: 'TRANSFERENCIA', contaDestinoId: 'c1' }).contaDestinoId)
  assert.deepEqual(validarLancamento({ ...base, tipo: 'TRANSFERENCIA', categoriaId: '', contaDestinoId: 'c2' }), {})
})

test('mensagemErroCaixa traduz erros do banco', () => {
  assert.match(mensagemErroCaixa({ message: 'Permissao negada: apenas ADMINISTRADOR' }), /administradores/)
  assert.match(mensagemErroCaixa({ message: 'Vendas e reembolsos de ingresso entram sozinhos; use outra categoria' }), /sozinhos/)
  assert.equal(mensagemErroCaixa(null, 'padrão'), 'padrão')
})

test('fluxo e planilhas', () => {
  const fluxo = mapearFluxo({
    de: '2026-11-01', ate: '2026-11-02', agrupamento: 'dia',
    totais: { entradas: '100', saidas: '40', saldo_inicial: '1000', saldo_final: '1060' },
    periodos: [
      { inicio: '2026-11-01', fim: '2026-11-01', entradas: 100, saidas: 0, resultado: 100, saldo: 1100 },
      { inicio: '2026-11-02', fim: '2026-11-02', entradas: 0, saidas: 40, resultado: -40, saldo: 1060 }
    ],
    por_categoria: [{ categoria_id: 'x', categoria_nome: 'Bar', tipo: 'ENTRADA', total: '100' }]
  })
  assert.equal(fluxo.totais.saldoFinal, 1060)
  assert.equal(fluxo.porCategoria[0]!.total, 100)
  assert.deepEqual(linhasPlanilhaFluxo(fluxo)[1], ['02/11/2026', 0, 40, -40, 1060])

  const semSaldo = mapearFluxo({ totais: { saldo_inicial: null }, periodos: [] })
  assert.equal(semSaldo.totais.saldoInicial, null)

  const linhas = linhasPlanilhaLancamentos([
    mapearLancamento({ id: 'T', origem: 'MANUAL', tipo: 'TRANSFERENCIA', data: '2026-11-02', valor: 30, conta_nome: 'Caixa', conta_destino_nome: 'Itaú' })
  ])
  assert.equal(linhas[0]![4], 'Caixa → Itaú')

  const xml = planilhaXml({
    aba: 'X', titulo: 'T & <b>', colunas: [{ titulo: 'A', largura: 10 }, { titulo: 'V', largura: 10, moeda: true }],
    linhas: [['a', 10]], rodape: ['Total', 10]
  })
  assert.match(xml, /T &amp; &lt;b&gt;/)
  assert.match(xml, /<c r="B3" s="2"><v>10<\/v><\/c>/)
  assert.match(xml, /<c r="B4" s="3"><v>10<\/v><\/c>/)

  const zip = gerarPlanilhaXlsx({ aba: 'X', titulo: 'T', colunas: [{ titulo: 'A', largura: 10 }], linhas: [] })
  assert.equal(zip[0], 0x50)
  assert.equal(zip[1], 0x4b)
})

test('compressao de comprovante: so fotos grandes, sem aumentar', async () => {
  const { dimensoesReduzidas, nomeJpg, podeComprimir } = await import('../app/utils/comprimirImagem.ts')
  assert.deepEqual(dimensoesReduzidas(4032, 3024), { largura: 2000, altura: 1500 })
  assert.deepEqual(dimensoesReduzidas(3024, 4032), { largura: 1500, altura: 2000 })
  assert.deepEqual(dimensoesReduzidas(1200, 800), { largura: 1200, altura: 800 })
  assert.equal(podeComprimir('image/jpeg', 5 * 1024 * 1024), true)
  assert.equal(podeComprimir('image/jpeg', 500 * 1024), false)
  assert.equal(podeComprimir('application/pdf', 5 * 1024 * 1024), false)
  assert.equal(podeComprimir('image/heic', 5 * 1024 * 1024), false)
  assert.equal(nomeJpg('IMG_1234.PNG'), 'IMG_1234.jpg')
  assert.equal(nomeJpg('recibo'), 'recibo.jpg')
})

test('itens do formulario: converte, soma e ignora linhas vazias', async () => {
  const { itensDoForm, itemParaForm, somaItens, formatarQuantidade, mapearHistoricoItens } = await import('../app/utils/caixa.ts')
  const itens = itensDoForm([
    { descricao: ' RED LABEL 1L ', quantidade: '6', valorTotal: '419,40' },
    { descricao: 'Gelo', quantidade: '1,5', valorTotal: '1.000,00' },
    { descricao: 'Copo', quantidade: '2.5', valorTotal: '' },
    { descricao: '   ', quantidade: '1', valorTotal: '5' },
    { descricao: 'Sem qtd', quantidade: 'abc', valorTotal: '3' }
  ])
  assert.deepEqual(itens, [
    { descricao: 'RED LABEL 1L', quantidade: 6, valorTotal: 419.4 },
    { descricao: 'Gelo', quantidade: 1.5, valorTotal: 1000 },
    { descricao: 'Copo', quantidade: 2.5, valorTotal: 0 },
    { descricao: 'Sem qtd', quantidade: 1, valorTotal: 3 }
  ])
  assert.equal(somaItens(itens), 1422.4)
  assert.deepEqual(itemParaForm({ descricao: 'Gelo', quantidade: 1.5, valorTotal: 12 }), {
    descricao: 'Gelo',
    quantidade: '1,5',
    valorTotal: '12,00'
  })
  assert.equal(formatarQuantidade(6), '6')
  const h = mapearHistoricoItens({
    totais: { itens: 1, valor_total: '419.40' },
    produtos: [{ descricao: 'RED LABEL 1L', compras: 1, quantidade: '6.000', valor_total: 419.4, preco_medio: 69.9, ultimo_preco: 69.9, ultima_data: '2026-11-11', menor_preco: 69.9, maior_preco: null }],
    itens: [{ id: 'i1', descricao: 'RED LABEL 1L', quantidade: 6, valor_total: 419.4, valor_unitario: 69.9, lancamento_id: 'l1', tipo: 'SAIDA', data: '2026-11-11' }]
  })
  assert.equal(h.totais.valorTotal, 419.4)
  assert.equal(h.produtos[0]!.quantidade, 6)
  assert.equal(h.produtos[0]!.maiorPreco, null)
  assert.equal(h.itens[0]!.valorUnitario, 69.9)
  assert.equal(h.itens[0]!.lancamentoDescricao, null)
  assert.deepEqual(mapearHistoricoItens(null).itens, [])
})
