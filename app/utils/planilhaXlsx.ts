/**
 * Planilha .xlsx simples gerada no navegador (sem biblioteca).
 * Uma aba, titulo, linha de informacoes, cabecalho congelado e colunas de
 * moeda formatadas em R$. Usada nos downloads do caixa do Financeiro.
 */

export interface ColunaPlanilha {
  titulo: string
  largura: number
  moeda?: boolean
}

export interface DadosPlanilha {
  aba: string
  titulo: string
  info?: string
  colunas: ColunaPlanilha[]
  linhas: (string | number)[][]
  /** Linha final (ex.: totais), em negrito. */
  rodape?: (string | number)[]
}

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

// Estilos: 0 normal, 1 negrito, 2 moeda, 3 moeda negrito.
function celula(ref: string, valor: string | number, estilo = 0): string {
  const s = estilo ? ` s="${estilo}"` : ''
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${Number.isFinite(valor) ? valor : 0}</v></c>`
  if (valor === '') return `<c r="${ref}"${s}/>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${escaparXml(valor)}</t></is></c>`
}

function linhaXml(numero: number, valores: (string | number)[], estilos: number[] | number = 0): string {
  const celulas = valores
    .map((v, i) => celula(`${letraColuna(i)}${numero}`, v, Array.isArray(estilos) ? estilos[i] ?? 0 : estilos))
    .join('')
  return `<row r="${numero}">${celulas}</row>`
}

export function planilhaXml(dados: DadosPlanilha): string {
  const linhaTitulos = dados.info ? 3 : 2
  const estilosDados = dados.colunas.map((c) => (c.moeda ? 2 : 0))
  const estilosRodape = dados.colunas.map((c) => (c.moeda ? 3 : 1))
  const rows = [
    linhaXml(1, [dados.titulo], 1),
    ...(dados.info ? [linhaXml(2, [dados.info])] : []),
    linhaXml(linhaTitulos, dados.colunas.map((c) => c.titulo), 1),
    ...dados.linhas.map((l, i) => linhaXml(linhaTitulos + 1 + i, l, estilosDados))
  ]
  if (dados.rodape) {
    rows.push(linhaXml(linhaTitulos + 1 + dados.linhas.length, dados.rodape, estilosRodape))
  }
  const ultimaColuna = letraColuna(dados.colunas.length - 1)
  const ultimaLinha = linhaTitulos + dados.linhas.length
  const cols = dados.colunas
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura}" customWidth="1"/>`)
    .join('')

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${linhaTitulos}" topLeftCell="A${linhaTitulos + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${cols}</cols>` +
    `<sheetData>${rows.join('')}</sheetData>` +
    (dados.linhas.length > 0 ? `<autoFilter ref="A${linhaTitulos}:${ultimaColuna}${ultimaLinha}"/>` : '') +
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

const RELS_WORKBOOK =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  '</Relationships>'

const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot; #,##0.00;[Red]-&quot;R$&quot; #,##0.00"/></numFmts>' +
  '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="4">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>'

function workbook(aba: string): string {
  const nome = escaparXml(aba.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Planilha')
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets><sheet name="${nome}" sheetId="1" r:id="rId1"/></sheets>` +
    '</workbook>'
  )
}

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[n] = c >>> 0
  }
  return tabela
})()

function crc32Zip(dados: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < dados.length; i++) crc = TABELA_CRC[(crc ^ dados[i]!) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

/** Zip minimo (metodo "store", sem compressao) — suficiente para um .xlsx pequeno. */
function montarZip(arquivos: { nome: string; conteudo: string }[]): Uint8Array {
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

export function gerarPlanilhaXlsx(dados: DadosPlanilha): Uint8Array {
  return montarZip([
    { nome: '[Content_Types].xml', conteudo: CONTENT_TYPES },
    { nome: '_rels/.rels', conteudo: RELS_RAIZ },
    { nome: 'xl/workbook.xml', conteudo: workbook(dados.aba) },
    { nome: 'xl/_rels/workbook.xml.rels', conteudo: RELS_WORKBOOK },
    { nome: 'xl/styles.xml', conteudo: STYLES },
    { nome: 'xl/worksheets/sheet1.xml', conteudo: planilhaXml(dados) }
  ])
}

/** Baixa a planilha no navegador. */
export function baixarPlanilhaXlsx(nomeArquivo: string, dados: DadosPlanilha): void {
  const bytes = gerarPlanilhaXlsx(dados)
  const blob = new Blob([bytes as BlobPart], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo.endsWith('.xlsx') ? nomeArquivo : `${nomeArquivo}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
