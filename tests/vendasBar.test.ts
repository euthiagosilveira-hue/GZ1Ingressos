import { test } from 'node:test'
import assert from 'node:assert/strict'

import { linkRelatorioValido, lerRelatorioBar, numeroBr } from '../server/utils/relatorio-bar.ts'
import {
  eventoDoRelatorio,
  idealPeloConsumo,
  mapearConsumoBar,
  mensagemErroVendasBar,
  sugerirProdutoReposicao,
  sugerirVendasPorUnidade
} from '../app/utils/reposicao.ts'
import type { ProdutoReposicao } from '../app/types/reposicao.ts'

function linha(...cel: string[]) {
  return `<tr>${cel.map((c) => `<td class="text-end">\n   ${c}   </td>`).join('')}</tr>`
}

// Mesmo formato do "Resumo de vendas" do sistema do bar (dados inventados).
const RELATORIO = `<!DOCTYPE html><html><head><title>Resumo de vendas</title></head><body>
<style>.x{color:red} Grupo: Falso</style>
<div class="text-end"><div>
        14/11/2026 até
        15/11/2026    </div></div>
<div class="fw-bolder mt-3">Grupo: Bebidas        </div>
<table><thead><tr><th>Código</th><th>Descrição</th><th>Qtde</th><th>Custo R$</th><th>Preço R$</th></tr></thead><tbody>
${linha('31', 'BRAHMA LATA', '16,000', '0,00', '128,00')}
${linha('53', 'HEINEKEN LONG NECK', '1.004,000', '0,00', '12.048,00')}
${linha('31', 'BRAHMA LATA', '4,000', '0,00', '32,00')}
</tbody></table>
<div class="fw-bolder mt-3">Grupo: Porções</div>
<table><tbody>
${linha('18', 'ISCA DE TILAPIA &amp; MOLHO', '3,000', '0,00', '134,70')}
</tbody></table>
<table><thead><tr><th>Grupo</th><th>Quantidade</th><th>Custo R$</th><th>Preço R$</th></tr></thead><tbody>
${linha('Bebidas', '1.024,000', '0,00', '12.208,00')}
${linha('Porções', '3,000', '0,00', '134,70')}
</tbody></table>
<p>Relatório gerado em 15/11/2026</p></body></html>`

test('numeros no formato brasileiro', () => {
  assert.equal(numeroBr('1.196,000'), 1196)
  assert.equal(numeroBr('128,00'), 128)
  assert.equal(numeroBr('16'), 16)
  assert.equal(numeroBr('abc'), null)
  assert.equal(numeroBr('1.2.3'), null)
})

test('le o relatorio, soma linhas repetidas e confere com o resumo', () => {
  const r = lerRelatorioBar(RELATORIO)!
  assert.equal(r.de, '2026-11-14')
  assert.equal(r.ate, '2026-11-15')
  assert.deepEqual(r.produtos, [
    { grupo: 'Bebidas', codigo: '53', descricao: 'HEINEKEN LONG NECK', quantidade: 1004, valor: 12048 },
    { grupo: 'Bebidas', codigo: '31', descricao: 'BRAHMA LATA', quantidade: 20, valor: 160 },
    { grupo: 'Porções', codigo: '18', descricao: 'ISCA DE TILAPIA & MOLHO', quantidade: 3, valor: 134.7 }
  ])
  assert.equal(r.totalValor, 12342.7)
  assert.equal(r.totalQuantidade, 1027)
  assert.deepEqual(r.grupos.map((g) => g.grupo), ['Bebidas', 'Porções'])
  assert.equal(r.conferido, true)
})

test('aponta quando a soma nao bate com o resumo', () => {
  const r = lerRelatorioBar(RELATORIO.replace('12.208,00', '12.300,00'))!
  assert.equal(r.conferido, false)
})

test('html que nao e o relatorio nao e lido', () => {
  assert.equal(lerRelatorioBar('<html><body>Outra coisa</body></html>'), null)
  assert.equal(lerRelatorioBar('<div>14/11/2026 até 15/11/2026</div>'), null)
})

test('so aceita link de relatorio do sistema do bar', () => {
  assert.ok(linkRelatorioValido('https://compufour.s3.amazonaws.com/production/uploads/reports/report/abc.html'))
  assert.ok(linkRelatorioValido(' https://compufour.s3.sa-east-1.amazonaws.com/x/y.html '))
  assert.ok(linkRelatorioValido('https://s3.amazonaws.com/compufour/x/y.html'))
  assert.equal(linkRelatorioValido('http://compufour.s3.amazonaws.com/a.html'), null)
  assert.equal(linkRelatorioValido('https://evil.com/compufour.s3.amazonaws.com/a.html'), null)
  assert.equal(linkRelatorioValido('https://compufour.s3.amazonaws.com.evil.com/a.html'), null)
  assert.equal(linkRelatorioValido('https://s3.amazonaws.com/outro/a.html'), null)
  assert.equal(linkRelatorioValido('https://compufour.s3.amazonaws.com/a.pdf'), null)
  assert.equal(linkRelatorioValido('nada'), null)
})

function produto(id: string, nome: string, unidade = 'fardo', ativo = true): ProdutoReposicao {
  return { id, nome, unidade, unidadesPorEmbalagem: 1, unidadeAvulsa: 'unidade', fornecedor: null, ultimoPreco: null, quantidadeIdeal: 0, ativo }
}

const produtos = [
  produto('1', 'HEINEKEN 350ML FD/ 12UNID.'),
  produto('2', 'LONG NECK HEINEKEN 330ML FD/24'),
  produto('3', 'LONG NECK HEINEKEN ZERO 330ML FD/24'),
  produto('4', 'CERV BUDW 330ML', 'unidade'),
  produto('5', 'MONSTER GREEN ZERO 473ML FD/6UNID.'),
  produto('6', 'BEB ENERG EXT POWER'),
  produto('7', 'AMSTEL 350ML', 'unidade', false)
]

test('sugere o produto da reposicao pelo nome', () => {
  assert.equal(sugerirProdutoReposicao('HEINEKEN LATA', produtos)?.id, '1')
  assert.equal(sugerirProdutoReposicao('HEINEKEN LONG NECK', produtos)?.id, '2')
  assert.equal(sugerirProdutoReposicao('HEINEKEN ZERO ALCOOL', produtos)?.id, '3')
  assert.equal(sugerirProdutoReposicao('BUDWEISER LONG NECK', produtos)?.id, '4')
  assert.equal(sugerirProdutoReposicao('ENERGÉTICO MONSTER', produtos)?.id, '5')
  // Inativo nao entra; so embalagem em comum nao basta.
  assert.equal(sugerirProdutoReposicao('AMSTEL LATA', produtos), null)
  assert.equal(sugerirProdutoReposicao('CORONA LONG NECK', produtos), null)
})

test('sugere quantas vendas dao 1 unidade do pedido', () => {
  assert.equal(sugerirVendasPorUnidade({ nome: 'HEINEKEN 350ML FD/ 12UNID.', unidade: 'fardo' }), 12)
  assert.equal(sugerirVendasPorUnidade({ nome: 'LONG NECK AMSTEL ULTRA 330ML FD 24 UNID.', unidade: 'fardo' }), 24)
  assert.equal(sugerirVendasPorUnidade({ nome: 'KETCH PRED 7G C/144', unidade: 'caixa' }), 144)
  assert.equal(sugerirVendasPorUnidade({ nome: 'HEINEKEN 350ML FD/ 12UNID.', unidade: 'unidade' }), 1)
  // Embalagem cadastrada no produto tem prioridade
  assert.equal(sugerirVendasPorUnidade({ nome: 'Skol', unidade: 'fardo', unidadesPorEmbalagem: 12 }), 12)
  assert.equal(sugerirVendasPorUnidade({ nome: 'GELO', unidade: 'pacote' }), 1)
})

test('ideal pelo consumo: media + 20%, para cima', () => {
  assert.equal(idealPeloConsumo(10), 12)
  assert.equal(idealPeloConsumo(2.5), 3)
  assert.equal(idealPeloConsumo(0), 0)
})

test('evento da noite do relatorio (horario de Sao Paulo)', () => {
  const eventos = [
    { id: 'a', inicioEm: '2026-11-14T21:00:00+00:00' },
    { id: 'b', inicioEm: '2026-11-08T01:00:00+00:00' } // 07/11 22h em SP
  ]
  assert.equal(eventoDoRelatorio(eventos, '2026-11-14')?.id, 'a')
  assert.equal(eventoDoRelatorio(eventos, '2026-11-07')?.id, 'b')
  assert.equal(eventoDoRelatorio(eventos, '2026-11-08'), null)
})

test('consumo por produto', () => {
  const c = mapearConsumoBar({ semanas: 2, produtos: [{ produto_id: 'p1', total: '24', media_semanal: '12' }] })
  assert.equal(c.semanas, 2)
  assert.deepEqual(c.porProduto, { p1: { total: 24, mediaSemanal: 12 } })
  assert.deepEqual(mapearConsumoBar(null), { semanas: 0, porProduto: {} })
})

test('mensagens de erro das vendas do bar', () => {
  assert.match(mensagemErroVendasBar({ data: { statusMessage: 'LINK_EXPIRADO' } }), /expirado/)
  assert.match(mensagemErroVendasBar({ message: 'Ja existe um relatorio do bar com esse periodo' }), /já foi importado/)
  assert.match(mensagemErroVendasBar({ message: 'Could not find the function' }), /SQL/)
})
