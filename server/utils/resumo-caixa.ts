// Monitor do caixa: funcoes puras do resumo semanal e das notificacoes.
// Os numeros vem do banco (private.financeiro_dados_resumo); a IA so escreve
// o texto. Sem IA (chave ausente, limite gratuito), sai um resumo simples.

export interface DadosResumoCaixa {
  periodo: { de: string; ate: string; dias: number }
  entradas: number
  saidas: number
  entradas_anterior: number
  saidas_anterior: number
  bar: number
  bar_anterior: number
  ingressos: number
  ingressos_anterior: number
  por_categoria: { categoria: string; tipo: 'ENTRADA' | 'SAIDA'; total: number }[]
  maiores_saidas: { valor: number; data: string; categoria: string | null; descricao: string | null }[]
  eventos: { nome: string; data: string; ingressos: number; bar: number; saidas: number }[]
  saldos: { conta: string; saldo: number }[]
  saldo_total: number
  contas_fixas_proximos_7_dias: { nome: string; vencimento: string }[]
  avisos_na_semana: string[]
}

export interface TextoResumo {
  manchete: string
  texto: string
}

export interface AvisoCaixa {
  id: string
  tipo: string
  titulo: string
  mensagem: string
}

export interface NotificacaoCaixa {
  title: string
  body: string
  url: string
  tag?: string
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function moeda(valor: unknown): string {
  return BRL.format(Number(valor) || 0)
}

function somarDias(dataIso: string, dias: number): string {
  const d = new Date(`${dataIso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** dd/mm de uma data AAAA-MM-DD. */
export function diaMes(dataIso: string): string {
  const [, m, d] = String(dataIso).slice(0, 10).split('-')
  return `${d}/${m}`
}

/**
 * Ultima semana fechada (segunda a domingo) antes de hoje.
 * Numa segunda-feira, e a semana que terminou ontem.
 */
export function ultimaSemanaFechada(hojeIso: string): { de: string; ate: string } {
  const diaSemana = new Date(`${hojeIso}T12:00:00Z`).getUTCDay() // 0 = domingo
  const voltar = diaSemana === 0 ? 7 : diaSemana
  const ate = somarDias(hojeIso, -voltar)
  return { de: somarDias(ate, -6), ate }
}

export function chaveResumo(de: string): string {
  return `resumo:${de}`
}

export function tituloResumo(de: string, ate: string): string {
  return `Resumo da semana ${diaMes(de)} a ${diaMes(ate)}`
}

export const SCHEMA_RESUMO = {
  type: 'OBJECT',
  properties: {
    manchete: { type: 'STRING' },
    texto: { type: 'STRING' }
  },
  required: ['manchete', 'texto']
}

export function promptResumo(dados: DadosResumoCaixa): string {
  return [
    'Você é o assistente financeiro da Galeria Zero 1, uma casa de shows com bar.',
    'Escreva o resumo da semana do caixa para o dono, que não é da área financeira.',
    'Regras:',
    '- Português do Brasil, frases curtas e simples, sem termos técnicos.',
    '- Use SOMENTE os números do JSON abaixo. Não invente valores nem causas.',
    '- Valores em reais no formato R$ 1.234,56.',
    '- Compare com a semana anterior quando houver número dos dois lados (diga se subiu ou caiu).',
    '- "entradas"/"saidas" não incluem transferências entre contas.',
    '- Se não houve movimento, diga isso de forma direta.',
    '- Termine com o que pede atenção: contas fixas dos próximos 7 dias e avisos da semana, se houver.',
    'Formato da resposta:',
    '- "manchete": uma linha de até 110 caracteres com o principal da semana (vai na notificação do celular).',
    '- "texto": até 8 linhas curtas, cada uma começando com "• ", separadas por quebra de linha.',
    '',
    'Dados (JSON):',
    JSON.stringify(dados)
  ].join('\n')
}

export function corpoPedidoResumo(dados: DadosResumoCaixa): Record<string, unknown> {
  return {
    contents: [{ role: 'user', parts: [{ text: promptResumo(dados) }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: SCHEMA_RESUMO
    }
  }
}

/** Le o JSON da IA. null quando veio vazio ou quebrado. */
export function interpretarResumo(texto: string): TextoResumo | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(String(texto ?? '').trim())
  } catch {
    return null
  }
  const r = bruto as { manchete?: unknown; texto?: unknown } | null
  const manchete = typeof r?.manchete === 'string' ? r.manchete.trim() : ''
  const corpo = typeof r?.texto === 'string' ? r.texto.trim() : ''
  if (!manchete || !corpo) return null
  return { manchete: manchete.slice(0, 160), texto: corpo.slice(0, 2000) }
}

function comparacao(atual: number, anterior: number): string {
  if (!anterior) return ''
  const diferenca = ((atual - anterior) / anterior) * 100
  if (Math.abs(diferenca) < 1) return ' (igual à semana anterior)'
  return ` (${diferenca > 0 ? 'subiu' : 'caiu'} ${Math.round(Math.abs(diferenca))}% em relação à semana anterior)`
}

/** Resumo simples, sem IA (reserva quando o Gemini nao responde). */
export function resumoSemIa(dados: DadosResumoCaixa): TextoResumo {
  const entradas = Number(dados.entradas) || 0
  const saidas = Number(dados.saidas) || 0
  const sobra = entradas - saidas
  const linhas = [
    `• Entrou ${moeda(entradas)} e saiu ${moeda(saidas)}: ${sobra >= 0 ? 'sobrou' : 'faltou'} ${moeda(Math.abs(sobra))}.`,
    `• Bar: ${moeda(dados.bar)}${comparacao(Number(dados.bar) || 0, Number(dados.bar_anterior) || 0)}.`,
    `• Ingressos: ${moeda(dados.ingressos)}${comparacao(Number(dados.ingressos) || 0, Number(dados.ingressos_anterior) || 0)}.`
  ]
  const maior = dados.maiores_saidas?.[0]
  if (maior) {
    linhas.push(`• Maior gasto: ${moeda(maior.valor)} em ${maior.categoria ?? 'sem categoria'} (${diaMes(maior.data)}).`)
  }
  linhas.push(`• Saldo de todas as contas hoje: ${moeda(dados.saldo_total)}.`)
  const fixas = dados.contas_fixas_proximos_7_dias ?? []
  if (fixas.length) {
    linhas.push(`• Contas para os próximos 7 dias: ${fixas.map((f) => `${f.nome} (${diaMes(f.vencimento)})`).join(', ')}.`)
  }
  const avisos = dados.avisos_na_semana ?? []
  if (avisos.length) linhas.push(`• ${avisos.length === 1 ? '1 aviso' : `${avisos.length} avisos`} do caixa na semana.`)

  return {
    manchete: `Entrou ${moeda(entradas)}, saiu ${moeda(saidas)}. Saldo hoje: ${moeda(dados.saldo_total)}.`,
    texto: linhas.join('\n')
  }
}

/** Uma notificacao para os avisos novos (um aviso: ele mesmo; varios: lista). */
export function notificacaoAvisos(avisos: AvisoCaixa[]): NotificacaoCaixa | null {
  if (!avisos.length) return null
  if (avisos.length === 1) {
    const a = avisos[0]!
    return { title: `⚠️ ${a.titulo}`, body: a.mensagem, url: '/financeiro', tag: `caixa-${a.id}` }
  }
  const primeiros = avisos.slice(0, 4).map((a) => `• ${a.titulo}`)
  if (avisos.length > 4) primeiros.push(`• e mais ${avisos.length - 4}`)
  return {
    title: `⚠️ ${avisos.length} avisos do caixa`,
    body: primeiros.join('\n'),
    url: '/financeiro',
    tag: 'caixa-avisos'
  }
}

export function notificacaoResumo(de: string, ate: string, manchete: string): NotificacaoCaixa {
  return {
    title: `📊 ${tituloResumo(de, ate)}`,
    body: `${manchete}\nToque para ver o resumo completo.`,
    url: '/financeiro',
    tag: `resumo-${de}`
  }
}
