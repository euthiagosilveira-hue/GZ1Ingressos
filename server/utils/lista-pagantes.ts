/**
 * Lista de pagantes de um evento para baixar (Excel .xlsx e bloco de notas .txt).
 * Serve de contingencia: se o sistema cair, a portaria confere os nomes no papel/planilha.
 * Funcoes puras (sem Supabase), para poderem ser testadas.
 */

export interface PaganteOrigem {
  codigo: string
  participante_nome: string | null
  status: string
  utilizado_em: string | null
  pedidos: {
    codigo: string | null
    comprador_nome: string | null
    comprador_telefone: string | null
    status: string | null
  } | null
  lotes: { nome: string | null } | null
}

export interface LinhaPagante {
  numero: number
  participante: string
  codigo: string
  situacao: string
  comprador: string
  telefone: string
  pedido: string
  qtdPedido: number
  lote: string
}

export interface CabecalhoLista {
  eventoNome: string
  eventoInicio: string | null
  geradaEm: Date
}

const FUSO = 'America/Sao_Paulo'

/** Ingressos que contam como "pagante": ingresso valido ou ja usado, de pedido pago. */
export function ehPagante(item: PaganteOrigem): boolean {
  return (item.status === 'VALIDO' || item.status === 'UTILIZADO') && item.pedidos?.status === 'PAGO'
}

export function formatarTelefonePagante(valor: string | null | undefined): string {
  const digitos = String(valor ?? '').replace(/\D/g, '')
  const local = digitos.length > 11 && digitos.startsWith('55') ? digitos.slice(2) : digitos
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return String(valor ?? '').trim()
}

export function formatarDataHoraBr(valor: string | Date | null | undefined): string {
  if (!valor) return ''
  const data = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(data.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data)
}

/** Filtra os pagantes, ordena por nome (A-Z) e numera. */
export function montarLinhasPagantes(itens: PaganteOrigem[]): LinhaPagante[] {
  const pagantes = itens.filter(ehPagante)

  const porPedido = new Map<string, number>()
  for (const item of pagantes) {
    const chave = item.pedidos?.codigo ?? ''
    porPedido.set(chave, (porPedido.get(chave) ?? 0) + 1)
  }

  return pagantes
    .map((item) => ({
      participante: (item.participante_nome ?? '').trim() || '(sem nome)',
      codigo: item.codigo,
      situacao: item.status === 'UTILIZADO' ? 'Já entrou' : 'Válido',
      comprador: (item.pedidos?.comprador_nome ?? '').trim(),
      telefone: formatarTelefonePagante(item.pedidos?.comprador_telefone),
      pedido: item.pedidos?.codigo ?? '',
      qtdPedido: porPedido.get(item.pedidos?.codigo ?? '') ?? 1,
      lote: (item.lotes?.nome ?? '').trim()
    }))
    .sort(
      (a, b) =>
        a.participante.localeCompare(b.participante, 'pt-BR', { sensitivity: 'base' }) ||
        a.codigo.localeCompare(b.codigo)
    )
    .map((linha, indice) => ({ numero: indice + 1, ...linha }))
}

function resumo(linhas: LinhaPagante[]): string {
  const entraram = linhas.filter((l) => l.situacao === 'Já entrou').length
  const total = linhas.length
  return `${total} ${total === 1 ? 'ingresso' : 'ingressos'} (${total - entraram} ainda não entraram, ${entraram} já entraram)`
}

/** Nome de arquivo seguro: "pagantes-nome-do-evento". */
export function nomeArquivoPagantes(eventoNome: string): string {
  const base = eventoNome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `pagantes-${base || 'evento'}`
}

// ---------------------------------------------------------------------------
// Bloco de notas (.txt)
// ---------------------------------------------------------------------------

/** Texto com quebra de linha do Windows e BOM, para abrir certo no Bloco de Notas. */
export function gerarTxtPagantes(cabecalho: CabecalhoLista, linhas: LinhaPagante[]): string {
  const largura = String(linhas.length).length
  const saida: string[] = [
    'GZ1 INGRESSOS - LISTA DE PAGANTES',
    `Evento: ${cabecalho.eventoNome}`
  ]
  if (cabecalho.eventoInicio) saida.push(`Data do evento: ${formatarDataHoraBr(cabecalho.eventoInicio)}`)
  saida.push(`Lista gerada em: ${formatarDataHoraBr(cabecalho.geradaEm)}`)
  saida.push(`Total: ${resumo(linhas)}`)
  saida.push('Ordem alfabética pelo nome do participante. Marque [X] quando a pessoa entrar.')
  saida.push('='.repeat(72))
  saida.push('')

  if (linhas.length === 0) {
    saida.push('Nenhum ingresso pago para este evento.')
  }

  for (const linha of linhas) {
    const numero = String(linha.numero).padStart(largura, '0')
    const marca = linha.situacao === 'Já entrou' ? '[X]' : '[ ]'
    saida.push(`${marca} ${numero}. ${linha.participante.toUpperCase()}`)
    const detalhes = [`Ingresso: ${linha.codigo}`]
    if (linha.lote) detalhes.push(`Lote: ${linha.lote}`)
    if (linha.situacao === 'Já entrou') detalhes.push('JÁ ENTROU')
    saida.push(`      ${detalhes.join(' | ')}`)
    const compra = [`Comprador: ${linha.comprador || '-'}`]
    if (linha.telefone) compra.push(`Tel: ${linha.telefone}`)
    compra.push(`Pedido: ${linha.pedido} (${linha.qtdPedido} ${linha.qtdPedido === 1 ? 'ingresso' : 'ingressos'})`)
    saida.push(`      ${compra.join(' | ')}`)
    saida.push('')
  }

  return '﻿' + saida.join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------
// Excel (.xlsx) — gerado sem biblioteca: um zip simples (sem compressao) com os XMLs.
// ---------------------------------------------------------------------------

const COLUNAS: { titulo: string; largura: number; valor: (l: LinhaPagante) => string | number }[] = [
  { titulo: 'Nº', largura: 6, valor: (l) => l.numero },
  { titulo: 'Participante', largura: 36, valor: (l) => l.participante },
  { titulo: 'Código do ingresso', largura: 18, valor: (l) => l.codigo },
  { titulo: 'Situação', largura: 12, valor: (l) => l.situacao },
  { titulo: 'Comprador', largura: 32, valor: (l) => l.comprador },
  { titulo: 'Telefone', largura: 17, valor: (l) => l.telefone },
  { titulo: 'Pedido', largura: 12, valor: (l) => l.pedido },
  { titulo: 'Ingressos no pedido', largura: 19, valor: (l) => l.qtdPedido },
  { titulo: 'Lote', largura: 18, valor: (l) => l.lote },
  { titulo: 'Conferido', largura: 11, valor: () => '' }
]

function escaparXml(texto: string): string {
  return texto
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function letraColuna(indice: number): string {
  let n = indice + 1
  let letras = ''
  while (n > 0) {
    const resto = (n - 1) % 26
    letras = String.fromCharCode(65 + resto) + letras
    n = Math.floor((n - 1) / 26)
  }
  return letras
}

function celula(ref: string, valor: string | number, estilo = 0): string {
  const s = estilo ? ` s="${estilo}"` : ''
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`
  if (valor === '') return `<c r="${ref}"${s}/>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`
}

function linhaXml(numero: number, valores: (string | number)[], estilo = 0): string {
  const celulas = valores.map((v, i) => celula(`${letraColuna(i)}${numero}`, v, estilo)).join('')
  return `<row r="${numero}">${celulas}</row>`
}

function planilhaXml(cabecalho: CabecalhoLista, linhas: LinhaPagante[]): string {
  const info = [
    `Evento: ${cabecalho.eventoNome}`,
    cabecalho.eventoInicio ? `Data: ${formatarDataHoraBr(cabecalho.eventoInicio)}` : '',
    `Gerada em: ${formatarDataHoraBr(cabecalho.geradaEm)}`,
    resumo(linhas)
  ].filter(Boolean).join('   •   ')

  const linhaTitulos = 3
  const rows = [
    linhaXml(1, ['GZ1 Ingressos - Lista de pagantes'], 1),
    linhaXml(2, [info]),
    linhaXml(linhaTitulos, COLUNAS.map((c) => c.titulo), 1),
    ...linhas.map((l, i) => linhaXml(linhaTitulos + 1 + i, COLUNAS.map((c) => c.valor(l))))
  ]
  const ultimaColuna = letraColuna(COLUNAS.length - 1)
  const ultimaLinha = linhaTitulos + Math.max(linhas.length, 0)
  const cols = COLUNAS.map(
    (c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura}" customWidth="1"/>`
  ).join('')

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${linhaTitulos}" topLeftCell="A${linhaTitulos + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    (linhas.length > 0 ? `<autoFilter ref="A${linhaTitulos}:${ultimaColuna}${ultimaLinha}"/>` : '') +
    '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    '<pageSetup orientation="landscape" fitToHeight="0"/>' +
    '</worksheet>'
  )
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
  '</Types>'

const RELS_RAIZ =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>'

const WORKBOOK =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="Pagantes" sheetId="1" r:id="rId1"/></sheets>' +
  '</workbook>'

const RELS_WORKBOOK =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>'

// Estilo 0 = normal, estilo 1 = negrito.
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[n] = c >>> 0
  }
  return tabela
})()

export function crc32Zip(dados: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < dados.length; i++) crc = TABELA_CRC[(crc ^ dados[i]!) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Zip minimo (metodo "store", sem compressao) — suficiente para um .xlsx pequeno. */
export function montarZip(arquivos: { nome: string; conteudo: string }[]): Uint8Array {
  const encoder = new TextEncoder()
  const partesLocais: Uint8Array[] = []
  const partesCentrais: Uint8Array[] = []
  let deslocamento = 0

  for (const arquivo of arquivos) {
    const nome = encoder.encode(arquivo.nome)
    const dados = encoder.encode(arquivo.conteudo)
    const crc = crc32Zip(dados)

    const local = new Uint8Array(30 + nome.length)
    const vl = new DataView(local.buffer)
    vl.setUint32(0, 0x04034b50, true)
    vl.setUint16(4, 20, true)
    vl.setUint16(6, 0x0800, true) // nomes em UTF-8
    vl.setUint16(8, 0, true)
    vl.setUint32(14, crc, true)
    vl.setUint32(18, dados.length, true)
    vl.setUint32(22, dados.length, true)
    vl.setUint16(26, nome.length, true)
    local.set(nome, 30)

    const central = new Uint8Array(46 + nome.length)
    const vc = new DataView(central.buffer)
    vc.setUint32(0, 0x02014b50, true)
    vc.setUint16(4, 20, true)
    vc.setUint16(6, 20, true)
    vc.setUint16(8, 0x0800, true)
    vc.setUint32(16, crc, true)
    vc.setUint32(20, dados.length, true)
    vc.setUint32(24, dados.length, true)
    vc.setUint16(28, nome.length, true)
    vc.setUint32(42, deslocamento, true)
    central.set(nome, 46)

    partesLocais.push(local, dados)
    partesCentrais.push(central)
    deslocamento += local.length + dados.length
  }

  const tamanhoCentral = partesCentrais.reduce((soma, p) => soma + p.length, 0)
  const fim = new Uint8Array(22)
  const vf = new DataView(fim.buffer)
  vf.setUint32(0, 0x06054b50, true)
  vf.setUint16(8, arquivos.length, true)
  vf.setUint16(10, arquivos.length, true)
  vf.setUint32(12, tamanhoCentral, true)
  vf.setUint32(16, deslocamento, true)

  const partes = [...partesLocais, ...partesCentrais, fim]
  const saida = new Uint8Array(partes.reduce((soma, p) => soma + p.length, 0))
  let pos = 0
  for (const parte of partes) {
    saida.set(parte, pos)
    pos += parte.length
  }
  return saida
}

export function gerarXlsxPagantes(cabecalho: CabecalhoLista, linhas: LinhaPagante[]): Uint8Array {
  return montarZip([
    { nome: '[Content_Types].xml', conteudo: CONTENT_TYPES },
    { nome: '_rels/.rels', conteudo: RELS_RAIZ },
    { nome: 'xl/workbook.xml', conteudo: WORKBOOK },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: RELS_WORKBOOK },
    { nome: 'xl/styles.xml', conteudo: STYLES },
    { nome: 'xl/worksheets/sheet1.xml', conteudo: planilhaXml(cabecalho, linhas) }
  ])
}
