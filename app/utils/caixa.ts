import type {
  Agrupamento,
  CategoriaCaixa,
  CategoriaFluxo,
  ContaCaixa,
  FluxoCaixa,
  HistoricoItens,
  ItemLancamento,
  LancamentoCaixa,
  OrigemLancamento,
  PeriodoFluxo,
  ResumoLancamentos,
  TipoCategoria,
  TipoConta,
  TipoLancamento
} from '~/types/caixa'

const FUSO = 'America/Sao_Paulo'

type Bruto = Record<string, unknown>

function num(valor: unknown): number {
  const n = typeof valor === 'number' ? valor : Number(valor ?? 0)
  return Number.isFinite(n) ? n : 0
}

function numOuNull(valor: unknown): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  return num(valor)
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function textoOuNull(valor: unknown): string | null {
  return typeof valor === 'string' && valor !== '' ? valor : null
}

// -----------------------------------------------------------------------------
// Mapeamento das respostas das RPCs
// -----------------------------------------------------------------------------
export function mapearConta(bruto: Bruto): ContaCaixa {
  return {
    id: texto(bruto.id),
    nome: texto(bruto.nome),
    tipo: (texto(bruto.tipo) || 'BANCO') as TipoConta,
    provedorIngressos: textoOuNull(bruto.provedor_ingressos),
    saldoInicial: num(bruto.saldo_inicial),
    saldoInicialEm: textoOuNull(bruto.saldo_inicial_em),
    configurada: bruto.configurada === true,
    ativa: bruto.ativa !== false,
    saldoAtual: num(bruto.saldo_atual)
  }
}

export function mapearCategoria(bruto: Bruto): CategoriaCaixa {
  return {
    id: texto(bruto.id),
    nome: texto(bruto.nome),
    tipo: (texto(bruto.tipo) || 'SAIDA') as TipoCategoria,
    chaveSistema: textoOuNull(bruto.chave_sistema),
    ativa: bruto.ativa !== false
  }
}

export function mapearLancamento(bruto: Bruto): LancamentoCaixa {
  return {
    id: texto(bruto.id),
    origem: (texto(bruto.origem) || 'MANUAL') as OrigemLancamento,
    lancamentoId: textoOuNull(bruto.lancamento_id),
    pagamentoId: textoOuNull(bruto.pagamento_id),
    pedidoId: textoOuNull(bruto.pedido_id),
    tipo: (texto(bruto.tipo) || 'ENTRADA') as TipoLancamento,
    data: texto(bruto.data),
    ocorridoEm: textoOuNull(bruto.ocorrido_em),
    valor: num(bruto.valor),
    descricao: texto(bruto.descricao),
    categoriaId: textoOuNull(bruto.categoria_id),
    categoriaNome: texto(bruto.categoria_nome),
    contaId: textoOuNull(bruto.conta_id),
    contaNome: texto(bruto.conta_nome),
    contaDestinoId: textoOuNull(bruto.conta_destino_id),
    contaDestinoNome: texto(bruto.conta_destino_nome),
    eventoId: textoOuNull(bruto.evento_id),
    eventoNome: texto(bruto.evento_nome),
    comprovantePath: textoOuNull(bruto.comprovante_path),
    grupoId: textoOuNull(bruto.grupo_id),
    canceladoEm: textoOuNull(bruto.cancelado_em),
    motivoCancelamento: texto(bruto.motivo_cancelamento),
    criadoPorNome: texto(bruto.criado_por_nome)
  }
}

export function mapearResumoLancamentos(bruto: Bruto | null | undefined): ResumoLancamentos {
  const r = bruto ?? {}
  return {
    entradas: num(r.entradas),
    saidas: num(r.saidas),
    transferenciasEntrada: num(r.transferencias_entrada),
    transferenciasSaida: num(r.transferencias_saida),
    quantidade: num(r.quantidade)
  }
}

export function mapearFluxo(bruto: Bruto | null | undefined): FluxoCaixa {
  const r = bruto ?? {}
  const totais = (r.totais ?? {}) as Bruto
  const periodos = Array.isArray(r.periodos) ? (r.periodos as Bruto[]) : []
  const categorias = Array.isArray(r.por_categoria) ? (r.por_categoria as Bruto[]) : []
  const agrupamento = texto(r.agrupamento)
  return {
    de: texto(r.de),
    ate: texto(r.ate),
    agrupamento: (agrupamento === 'semana' || agrupamento === 'mes' ? agrupamento : 'dia') as Agrupamento,
    totais: {
      entradas: num(totais.entradas),
      saidas: num(totais.saidas),
      saldoInicial: numOuNull(totais.saldo_inicial),
      saldoFinal: numOuNull(totais.saldo_final)
    },
    periodos: periodos.map(
      (p): PeriodoFluxo => ({
        inicio: texto(p.inicio),
        fim: texto(p.fim),
        entradas: num(p.entradas),
        saidas: num(p.saidas),
        resultado: num(p.resultado),
        saldo: numOuNull(p.saldo)
      })
    ),
    porCategoria: categorias.map(
      (c): CategoriaFluxo => ({
        categoriaId: textoOuNull(c.categoria_id),
        categoriaNome: texto(c.categoria_nome),
        tipo: (texto(c.tipo) || 'SAIDA') as TipoCategoria,
        total: num(c.total)
      })
    )
  }
}

// -----------------------------------------------------------------------------
// Valores e datas
// -----------------------------------------------------------------------------

/**
 * Converte o que a pessoa digitou em reais para numero.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 50" e "50". Invalido -> null.
 */
export function lerValorReais(entrada: string | number | null | undefined): number | null {
  if (typeof entrada === 'number') return Number.isFinite(entrada) ? Math.round(entrada * 100) / 100 : null
  let s = String(entrada ?? '').replace(/R\$/gi, '').replace(/\s/g, '')
  if (s === '') return null
  if (s.includes(',')) {
    // Formato brasileiro: ponto = milhar, virgula = decimal.
    s = s.replace(/\./g, '').replace(',', '.')
  } else if ((s.match(/\./g) ?? []).length > 1 || /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // "1.234" ou "1.234.567" = milhar.
    s = s.replace(/\./g, '')
  }
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

/** Data de hoje (ou de `agora`) no horario de Brasilia, no formato AAAA-MM-DD. */
export function hojeIso(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(agora)
  return partes
}

function deIso(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a!, (m ?? 1) - 1, d ?? 1))
}

function paraIso(data: Date): string {
  return data.toISOString().slice(0, 10)
}

export function somarDias(iso: string, dias: number): string {
  const d = deIso(iso)
  d.setUTCDate(d.getUTCDate() + dias)
  return paraIso(d)
}

export type PresetPeriodo = 'HOJE' | 'SETE_DIAS' | 'TRINTA_DIAS' | 'ESTE_MES' | 'MES_PASSADO' | 'ESTE_ANO' | 'TUDO'

export const PRESETS_PERIODO: { value: PresetPeriodo; label: string }[] = [
  { value: 'HOJE', label: 'Hoje' },
  { value: 'SETE_DIAS', label: 'Últimos 7 dias' },
  { value: 'TRINTA_DIAS', label: 'Últimos 30 dias' },
  { value: 'ESTE_MES', label: 'Este mês' },
  { value: 'MES_PASSADO', label: 'Mês passado' },
  { value: 'ESTE_ANO', label: 'Este ano' },
  { value: 'TUDO', label: 'Tudo' }
]

/** Intervalo [de, ate] (AAAA-MM-DD) de um preset. TUDO = sem limite. */
export function intervaloPreset(
  preset: PresetPeriodo,
  hoje: string = hojeIso()
): { de: string | null; ate: string | null } {
  const [ano, mes] = hoje.split('-').map(Number) as [number, number]
  switch (preset) {
    case 'HOJE':
      return { de: hoje, ate: hoje }
    case 'SETE_DIAS':
      return { de: somarDias(hoje, -6), ate: hoje }
    case 'TRINTA_DIAS':
      return { de: somarDias(hoje, -29), ate: hoje }
    case 'ESTE_MES':
      return { de: `${ano}-${String(mes).padStart(2, '0')}-01`, ate: hoje }
    case 'MES_PASSADO': {
      const inicio = new Date(Date.UTC(ano, mes - 2, 1))
      const fim = new Date(Date.UTC(ano, mes - 1, 0))
      return { de: paraIso(inicio), ate: paraIso(fim) }
    }
    case 'ESTE_ANO':
      return { de: `${ano}-01-01`, ate: hoje }
    default:
      return { de: null, ate: null }
  }
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-11-05" -> "05/11/2026". */
export function formatarDataCurta(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return ''
  return `${m[3]}/${m[2]}/${m[1]}`
}

/** Rotulo curto de um periodo do fluxo ("05/11", "sem. 03/11", "nov/26"). */
export function rotuloPeriodo(periodo: { inicio: string }, agrupamento: Agrupamento): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(periodo.inicio)
  if (!m) return ''
  if (agrupamento === 'mes') return `${MESES[Number(m[2]) - 1]}/${m[1]!.slice(2)}`
  if (agrupamento === 'semana') return `sem. ${m[3]}/${m[2]}`
  return `${m[3]}/${m[2]}`
}

/** Agrupamento sugerido para um periodo: ate 45 dias por dia, ate ~6 meses por semana, depois por mes. */
export function agrupamentoSugerido(de: string, ate: string): Agrupamento {
  const dias = Math.round((deIso(ate).getTime() - deIso(de).getTime()) / 86_400_000) + 1
  if (dias <= 45) return 'dia'
  if (dias <= 190) return 'semana'
  return 'mes'
}

// -----------------------------------------------------------------------------
// Rotulos
// -----------------------------------------------------------------------------
export const TIPOS_CONTA: { value: TipoConta; label: string }[] = [
  { value: 'BANCO', label: 'Banco' },
  { value: 'MAQUININHA', label: 'Maquininha' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'ONLINE', label: 'Pagamento online' }
]

export function rotuloTipoConta(tipo: TipoConta): string {
  return TIPOS_CONTA.find((t) => t.value === tipo)?.label ?? tipo
}

export function rotuloTipoLancamento(tipo: TipoLancamento): string {
  if (tipo === 'ENTRADA') return 'Entrada'
  if (tipo === 'SAIDA') return 'Saída'
  return 'Transferência'
}

export function rotuloOrigemLancamento(origem: OrigemLancamento): string {
  if (origem === 'INGRESSO') return 'Venda de ingresso (automática)'
  if (origem === 'REEMBOLSO') return 'Reembolso de ingresso (automático)'
  return 'Lançado à mão'
}

/** Descricao exibida: transferencia mostra "Origem -> Destino". */
export function contaExibida(l: LancamentoCaixa): string {
  if (l.tipo === 'TRANSFERENCIA') return `${l.contaNome} → ${l.contaDestinoNome}`
  return l.contaNome
}

/** Valor com sinal para somas/planilha: entrada +, saida -, transferencia 0 (so muda de conta). */
export function valorComSinal(l: LancamentoCaixa): number {
  if (l.tipo === 'ENTRADA') return l.valor
  if (l.tipo === 'SAIDA') return -l.valor
  return 0
}

export function podeEditar(l: LancamentoCaixa): boolean {
  return l.origem === 'MANUAL' && !l.canceladoEm && !!l.lancamentoId
}

// -----------------------------------------------------------------------------
// Validacao do formulario de lancamento
// -----------------------------------------------------------------------------
export interface FormLancamento {
  tipo: TipoLancamento
  data: string
  valor: string
  descricao: string
  categoriaId: string
  contaId: string
  contaDestinoId: string
  eventoId: string
}

export type ErrosLancamento = Partial<Record<keyof FormLancamento, string>>

export function validarLancamento(form: FormLancamento): ErrosLancamento {
  const erros: ErrosLancamento = {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.data)) erros.data = 'Informe a data.'
  const valor = lerValorReais(form.valor)
  if (valor === null || valor <= 0) erros.valor = 'Informe um valor maior que zero.'
  if (!form.contaId) erros.contaId = 'Escolha a conta.'
  if (form.tipo === 'TRANSFERENCIA') {
    if (!form.contaDestinoId) erros.contaDestinoId = 'Escolha a conta de destino.'
    else if (form.contaDestinoId === form.contaId) erros.contaDestinoId = 'Escolha uma conta diferente da origem.'
  } else if (!form.categoriaId) {
    erros.categoriaId = 'Escolha a categoria.'
  }
  return erros
}

/** Traduz erros das RPCs do caixa para mensagens simples. */
export function mensagemErroCaixa(erro: unknown, padrao = 'Não foi possível salvar. Tente novamente.'): string {
  const msg = erro && typeof erro === 'object' && 'message' in erro ? String((erro as { message: unknown }).message) : ''
  if (/Permissao negada/i.test(msg)) return 'Só administradores podem mexer no financeiro.'
  if (/entram sozinhos/i.test(msg)) return 'Vendas e reembolsos de ingresso entram sozinhos. Use outra categoria.'
  if (/pelo menos uma maquininha/i.test(msg)) return 'Informe o valor de pelo menos uma maquininha ou do dinheiro.'
  if (/Ja existe uma categoria/i.test(msg)) return 'Já existe uma categoria com esse nome.'
  if (/usada pelo sistema/i.test(msg)) return 'Esta categoria é usada pelo sistema: só o nome pode mudar.'
  if (/trocar entre entrada e saida/i.test(msg)) return 'Esta categoria já tem lançamentos: não dá para trocar entre entrada e saída.'
  if (/destino/i.test(msg)) return 'Escolha uma conta de destino diferente da origem.'
  if (/motivo/i.test(msg)) return 'Informe o motivo do cancelamento.'
  return padrao
}

// -----------------------------------------------------------------------------
// Itens do comprovante
// -----------------------------------------------------------------------------
/** Linha do formulario de itens (valores como texto, igual ao campo de valor). */
export interface FormItem {
  descricao: string
  quantidade: string
  valorTotal: string
}

export function itemParaForm(item: ItemLancamento): FormItem {
  return {
    descricao: item.descricao,
    quantidade: String(Number(item.quantidade.toFixed(3))).replace('.', ','),
    valorTotal: item.valorTotal.toFixed(2).replace('.', ',')
  }
}

/** Converte as linhas do formulario; linhas sem nome sao ignoradas. */
export function itensDoForm(linhas: FormItem[]): ItemLancamento[] {
  const itens: ItemLancamento[] = []
  for (const l of linhas) {
    const descricao = l.descricao.trim().replace(/\s+/g, ' ')
    if (!descricao) continue
    const bruta = l.quantidade.trim()
    const q = Number(bruta.includes(',') ? bruta.replace(/\./g, '').replace(',', '.') : bruta)
    itens.push({
      descricao,
      quantidade: Number.isFinite(q) && q > 0 ? Math.round(q * 1000) / 1000 : 1,
      valorTotal: lerValorReais(l.valorTotal) ?? 0
    })
  }
  return itens
}

export function somaItens(itens: ItemLancamento[]): number {
  return Math.round(itens.reduce((t, i) => t + i.valorTotal, 0) * 100) / 100
}

function numeroOuNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function mapearItemLancamento(r: Record<string, unknown>): ItemLancamento {
  return {
    descricao: String(r.descricao ?? ''),
    quantidade: Number(r.quantidade ?? 1),
    valorTotal: Number(r.valor_total ?? 0)
  }
}

export function mapearHistoricoItens(r: Record<string, unknown> | null | undefined): HistoricoItens {
  const bruto = (r ?? {}) as Record<string, unknown>
  const totais = (bruto.totais ?? {}) as Record<string, unknown>
  const produtos = Array.isArray(bruto.produtos) ? (bruto.produtos as Record<string, unknown>[]) : []
  const itens = Array.isArray(bruto.itens) ? (bruto.itens as Record<string, unknown>[]) : []
  return {
    totais: { itens: Number(totais.itens ?? 0), valorTotal: Number(totais.valor_total ?? 0) },
    produtos: produtos.map((p) => ({
      descricao: String(p.descricao ?? ''),
      compras: Number(p.compras ?? 0),
      quantidade: Number(p.quantidade ?? 0),
      valorTotal: Number(p.valor_total ?? 0),
      precoMedio: numeroOuNull(p.preco_medio),
      ultimoPreco: numeroOuNull(p.ultimo_preco),
      ultimaData: p.ultima_data ? String(p.ultima_data) : null,
      menorPreco: numeroOuNull(p.menor_preco),
      maiorPreco: numeroOuNull(p.maior_preco)
    })),
    itens: itens.map((i) => ({
      ...mapearItemLancamento(i),
      id: String(i.id ?? ''),
      valorUnitario: numeroOuNull(i.valor_unitario),
      lancamentoId: String(i.lancamento_id ?? ''),
      tipo: String(i.tipo ?? 'SAIDA') as TipoLancamento,
      data: String(i.data ?? ''),
      lancamentoDescricao: i.lancamento_descricao ? String(i.lancamento_descricao) : null,
      comprovantePath: i.comprovante_path ? String(i.comprovante_path) : null,
      categoriaNome: i.categoria_nome ? String(i.categoria_nome) : null,
      contaNome: i.conta_nome ? String(i.conta_nome) : null,
      eventoNome: i.evento_nome ? String(i.evento_nome) : null
    }))
  }
}

/** Quantidade sem zeros sobrando: 6 -> "6", 1.5 -> "1,5". */
export function formatarQuantidade(q: number): string {
  return String(Number(q.toFixed(3))).replace('.', ',')
}

/** Mensagem amigavel quando a leitura do comprovante pela IA falha. */
export function mensagemErroLeituraIa(erro: unknown): string {
  const e = (erro ?? {}) as { statusMessage?: unknown; data?: { statusMessage?: unknown } }
  const codigo = String(e.data?.statusMessage ?? e.statusMessage ?? '')
  if (codigo === 'IA_NAO_CONFIGURADA') return 'A leitura automática ainda não está ligada (falta a chave do Gemini).'
  if (codigo === 'IA_CHAVE_INVALIDA') return 'A chave do Gemini foi recusada. Confira a chave na Vercel.'
  if (codigo === 'LIMITE_IA') return 'Limite gratuito da IA atingido por agora. Preencha à mão ou tente daqui a pouco.'
  if (codigo === 'NAO_LEU') return 'A IA não conseguiu ler este comprovante. Preencha à mão.'
  if (codigo === 'FORMATO_NAO_SUPORTADO') return 'A IA só lê foto (JPG/PNG) ou PDF.'
  return 'Não foi possível ler o comprovante agora. Preencha à mão.'
}

// -----------------------------------------------------------------------------
// Planilha
// -----------------------------------------------------------------------------
export const COLUNAS_PLANILHA_LANCAMENTOS = [
  { titulo: 'Data', largura: 12 },
  { titulo: 'Tipo', largura: 14 },
  { titulo: 'Descrição', largura: 42 },
  { titulo: 'Categoria', largura: 22 },
  { titulo: 'Conta', largura: 26 },
  { titulo: 'Evento', largura: 30 },
  { titulo: 'Valor (R$)', largura: 14, moeda: true },
  { titulo: 'Situação', largura: 22 }
]

export function linhasPlanilhaLancamentos(itens: LancamentoCaixa[]): (string | number)[][] {
  return itens.map((l) => [
    formatarDataCurta(l.data),
    rotuloTipoLancamento(l.tipo),
    l.descricao,
    l.tipo === 'TRANSFERENCIA' ? 'Transferência' : l.categoriaNome,
    contaExibida(l),
    l.eventoNome,
    l.tipo === 'TRANSFERENCIA' ? l.valor : valorComSinal(l),
    l.canceladoEm ? `Cancelado: ${l.motivoCancelamento}` : l.origem === 'MANUAL' ? 'Lançado' : 'Automático'
  ])
}

export const COLUNAS_PLANILHA_FLUXO = [
  { titulo: 'Período', largura: 24 },
  { titulo: 'Entradas (R$)', largura: 16, moeda: true },
  { titulo: 'Saídas (R$)', largura: 16, moeda: true },
  { titulo: 'Resultado (R$)', largura: 16, moeda: true },
  { titulo: 'Saldo no fim (R$)', largura: 18, moeda: true }
]

export function linhasPlanilhaFluxo(fluxo: FluxoCaixa): (string | number)[][] {
  return fluxo.periodos.map((p) => [
    p.inicio === p.fim
      ? formatarDataCurta(p.inicio)
      : `${formatarDataCurta(p.inicio)} a ${formatarDataCurta(p.fim)}`,
    p.entradas,
    p.saidas,
    p.resultado,
    p.saldo ?? ''
  ])
}
