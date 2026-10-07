import type {
  AdminEventoVendaManualRow,
  CriarVendaManualInput,
  EventoStatusVendaManual,
  EventoVendaManual,
  VendaManualForm
} from '~/types/vendaManual'

export const VENDA_MANUAL_QUANTIDADE_MIN = 1
export const VENDA_MANUAL_QUANTIDADE_MAX = 10

/** Arredonda para 2 casas decimais (mesma precisao de numeric(10,2)). */
function arredondarMoeda(valor: number): number {
  return Math.round(valor * 100) / 100
}

/** Total sempre derivado do preco do lote x quantidade. */
export function calcularTotalVendaManual(preco: number, quantidade: number): number {
  const p = Number(preco) || 0
  const q = Number(quantidade) || 0
  if (p <= 0 || q <= 0) return 0
  return arredondarMoeda(p * q)
}

/** Converte a linha bruta da RPC no view-model da tela. */
export function mapearEventoVendaManual(row: AdminEventoVendaManualRow): EventoVendaManual {
  return {
    id: row.evento_id,
    nome: row.nome,
    inicioEm: row.inicio_em,
    local: row.local,
    status: row.status as EventoStatusVendaManual,
    loteAtivo: row.lote_ativo_id
      ? {
          id: row.lote_ativo_id,
          nome: row.lote_ativo_nome ?? '',
          preco: Number(row.lote_ativo_preco ?? 0),
          disponiveis: Number(row.lote_ativo_disponiveis ?? 0)
        }
      : null
  }
}

/** Garante que a lista de participantes tenha exatamente `quantidade` itens. */
export function ajustarParticipantes(
  participantes: string[],
  quantidade: number,
  compradorNome = ''
): string[] {
  const total = Math.min(
    Math.max(Number(quantidade) || VENDA_MANUAL_QUANTIDADE_MIN, VENDA_MANUAL_QUANTIDADE_MIN),
    VENDA_MANUAL_QUANTIDADE_MAX
  )
  const base = participantes.slice(0, total)
  while (base.length < total) {
    base.push(base.length === 0 ? compradorNome : '')
  }
  return base
}

export type VendaManualErrors = Partial<
  Record<'eventoId' | 'loteId' | 'compradorNome' | 'compradorTelefone' | 'quantidade' | 'participantes', string>
>

export function validarVendaManual(
  form: VendaManualForm,
  evento: EventoVendaManual | null
): VendaManualErrors {
  const erros: VendaManualErrors = {}

  if (!form.eventoId) erros.eventoId = 'Selecione o evento.'
  if (!evento || !evento.loteAtivo) {
    erros.loteId = 'Este evento não possui lote ativo.'
  }

  if (!form.compradorNome.trim()) erros.compradorNome = 'Informe o nome do comprador.'
  if (!form.compradorTelefone.trim()) erros.compradorTelefone = 'Informe o telefone do comprador.'

  const quantidade = Number(form.quantidade)
  if (
    !Number.isInteger(quantidade) ||
    quantidade < VENDA_MANUAL_QUANTIDADE_MIN ||
    quantidade > VENDA_MANUAL_QUANTIDADE_MAX
  ) {
    erros.quantidade = `Quantidade entre ${VENDA_MANUAL_QUANTIDADE_MIN} e ${VENDA_MANUAL_QUANTIDADE_MAX}.`
  }

  const participantes = form.participantes.slice(0, Math.max(quantidade, 0))
  if (participantes.length !== quantidade) {
    erros.participantes = 'Informe o nome de todos os participantes.'
  } else if (participantes.some((nome) => !nome.trim())) {
    erros.participantes = 'O nome do participante não pode ser vazio.'
  }

  return erros
}

/** Monta o payload da RPC. O backend recalcula preco/total a partir do lote. */
export function montarPayloadVendaManual(form: VendaManualForm): CriarVendaManualInput {
  const email = form.compradorEmail.trim()
  return {
    eventoId: form.eventoId,
    loteId: form.loteId,
    compradorNome: form.compradorNome.trim(),
    compradorTelefone: form.compradorTelefone.trim(),
    compradorEmail: email ? email : null,
    participantes: form.participantes.slice(0, form.quantidade).map((nome) => nome.trim())
  }
}

interface RpcErrorLike {
  code?: string | null
  message?: string | null
}

/** Traduz erros da RPC de venda manual para mensagens ao operador. */
export function mensagemErroVendaManual(error: RpcErrorLike | null): string {
  const e = error ?? {}
  const mensagem = (e.message ?? '').toLowerCase()

  if (e.code === '42501' || mensagem.includes('permiss')) {
    return 'Você não tem permissão para registrar vendas manuais.'
  }
  if (mensagem.includes('estoque insuficiente')) {
    return 'Estoque insuficiente no evento.'
  }
  if (mensagem.includes('limite do lote')) {
    return 'Estoque insuficiente no lote selecionado.'
  }
  if (mensagem.includes('nao esta ativo') || mensagem.includes('não está ativo')) {
    return 'O lote selecionado não está ativo.'
  }
  if (mensagem.includes('nao permite venda manual') || mensagem.includes('não permite venda manual')) {
    return 'Este evento não permite venda manual.'
  }
  if (mensagem.includes('nao encontrado') || mensagem.includes('não encontrado')) {
    return 'Evento ou lote não encontrado.'
  }
  if (e.code === '23514' || e.code === '22004') {
    return 'Não foi possível concluir a venda. Verifique os dados informados.'
  }
  return 'Não foi possível registrar a venda manual.'
}
