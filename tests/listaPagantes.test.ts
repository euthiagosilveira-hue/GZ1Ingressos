import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { crc32 } from 'node:zlib'

import {
  crc32Zip,
  formatarTelefonePagante,
  gerarTxtPagantes,
  gerarXlsxPagantes,
  montarLinhasPagantes,
  nomeArquivoPagantes,
  type PaganteOrigem
} from '../server/utils/lista-pagantes.ts'

function ler(caminho: string): string {
  return readFileSync(fileURLToPath(new URL(caminho, import.meta.url)), 'utf8')
}

function ingresso(over: Partial<PaganteOrigem> = {}): PaganteOrigem {
  return {
    codigo: 'GZ100001-01',
    participante_nome: 'Fulano',
    status: 'VALIDO',
    utilizado_em: null,
    pedidos: { codigo: 'GZ100001', comprador_nome: 'Comprador', comprador_telefone: '34999998888', status: 'PAGO' },
    lotes: { nome: 'Lote 1' },
    ...over
  }
}

const cabecalho = { eventoNome: 'Samba & Cia', eventoInicio: '2026-10-24T21:00:00+00:00', geradaEm: new Date('2026-10-23T20:00:00Z') }

test('montarLinhasPagantes: so pagos validos/utilizados, A-Z, numerados, qtd por pedido', () => {
  const linhas = montarLinhasPagantes([
    ingresso({ codigo: 'A-01', participante_nome: 'Zeca' }),
    ingresso({ codigo: 'A-02', participante_nome: 'ágata', status: 'UTILIZADO' }),
    ingresso({ codigo: 'B-01', participante_nome: 'Bruno', status: 'EXPIRADO' }),
    ingresso({ codigo: 'C-01', participante_nome: 'Caio', pedidos: { codigo: 'C', comprador_nome: 'X', comprador_telefone: null, status: 'EXPIRADO' } })
  ])
  assert.deepEqual(linhas.map((l) => [l.numero, l.participante, l.situacao, l.qtdPedido]), [
    [1, 'ágata', 'Já entrou', 2],
    [2, 'Zeca', 'Válido', 2]
  ])
})

test('formatarTelefonePagante', () => {
  assert.equal(formatarTelefonePagante('5534999998888'), '(34) 99999-8888')
  assert.equal(formatarTelefonePagante('3433334444'), '(34) 3333-4444')
  assert.equal(formatarTelefonePagante(null), '')
})

test('nomeArquivoPagantes sem acentos/simbolos', () => {
  assert.equal(nomeArquivoPagantes('Samba é a Nossa Cara!'), 'pagantes-samba-e-a-nossa-cara')
})

test('gerarTxtPagantes: BOM, CRLF, cabecalho e marcacao de quem entrou', () => {
  const txt = gerarTxtPagantes(cabecalho, montarLinhasPagantes([
    ingresso({ participante_nome: 'Ana' }),
    ingresso({ codigo: 'GZ100001-02', participante_nome: 'Bia', status: 'UTILIZADO' })
  ]))
  assert.ok(txt.startsWith('﻿GZ1 INGRESSOS - LISTA DE PAGANTES\r\n'))
  assert.ok(txt.includes('Evento: Samba & Cia'))
  assert.ok(txt.includes('[ ] 1. ANA'))
  assert.ok(txt.includes('[X] 2. BIA'))
  assert.ok(txt.includes('Tel: (34) 99999-8888'))
  assert.ok(txt.includes('2 ingressos (1 ainda não entraram, 1 já entraram)'))
})

test('crc32Zip igual ao zlib', () => {
  const dados = new TextEncoder().encode('GZ1 Ingressos — ção')
  assert.equal(crc32Zip(dados), crc32(dados))
})

test('gerarXlsxPagantes: zip valido com planilha e XML escapado', () => {
  const zip = gerarXlsxPagantes(cabecalho, montarLinhasPagantes([ingresso({ participante_nome: 'Tom <&> Jerry' })]))
  const texto = new TextDecoder().decode(zip)
  assert.equal(zip[0], 0x50)
  assert.equal(zip[1], 0x4b)
  assert.ok(texto.includes('xl/worksheets/sheet1.xml'))
  assert.ok(texto.includes('Tom &lt;&amp;&gt; Jerry'))
  assert.ok(texto.includes('Samba &amp; Cia'))
})

test('endpoint exige admin e menu do evento tem os dois downloads', () => {
  const endpoint = ler('../server/api/admin/eventos/[id]/pagantes.get.ts')
  assert.ok(endpoint.includes('exigirAdmin(event)'))
  assert.ok(endpoint.includes(".in('status', ['VALIDO', 'UTILIZADO'])"))
  const menu = ler('../app/components/eventos/EventCardActions.vue')
  assert.ok(menu.includes("selecionar('pagantes-xlsx')"))
  assert.ok(menu.includes("selecionar('pagantes-txt')"))
})
