// Leitura do vencimento de uma conta (boleto, fatura de luz/agua/internet,
// aluguel) com a IA, para preencher o "vence todo dia" da conta fixa.

export interface LeituraVencimento {
  /** Dia do mes do vencimento (1 a 31). */
  dia: number
  /** Data completa do vencimento (AAAA-MM-DD), quando lida. */
  vencimento: string | null
  /** Valor da conta em reais, quando lido. */
  valor: number | null
  /** Empresa/beneficiario (ex.: "CEMIG"). */
  empresa: string | null
}

export function promptVencimento(hoje: string): string {
  return [
    'Você lê a foto ou PDF de uma CONTA A PAGAR (boleto, fatura de energia, água, internet, aluguel, segurança etc.).',
    `Hoje é ${hoje}.`,
    'Extraia:',
    '- vencimento: a data de VENCIMENTO da conta, no formato AAAA-MM-DD. Não confunda com data de emissão, leitura, referência ou pagamento.',
    '- valor: o valor total a pagar, em reais, como número (ex.: 350.9).',
    '- empresa: o nome curto da empresa ou do beneficiário (ex.: "CEMIG", "Vivo").',
    'Se algum dado não aparecer, deixe vazio (null). Não invente.'
  ].join('\n')
}

export const SCHEMA_VENCIMENTO: Record<string, unknown> = {
  type: 'OBJECT',
  properties: {
    vencimento: { type: 'STRING', nullable: true },
    valor: { type: 'NUMBER', nullable: true },
    empresa: { type: 'STRING', nullable: true }
  }
}

/** Le o JSON da IA. null quando nao achou um vencimento valido. */
export function interpretarVencimento(texto: string): LeituraVencimento | null {
  let bruto: unknown
  try {
    bruto = JSON.parse(String(texto ?? '').trim())
  } catch {
    return null
  }
  const r = (bruto ?? {}) as { vencimento?: unknown; valor?: unknown; empresa?: unknown }
  const data = typeof r.vencimento === 'string' ? r.vencimento.trim().slice(0, 10) : ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data)
  if (!m) return null
  const dia = Number(m[3])
  const mes = Number(m[2])
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null
  const valor = typeof r.valor === 'number' && Number.isFinite(r.valor) && r.valor > 0 ? Math.round(r.valor * 100) / 100 : null
  const empresa = typeof r.empresa === 'string' && r.empresa.trim() ? r.empresa.trim().slice(0, 80) : null
  return { dia, vencimento: data, valor, empresa }
}
