import type { LotActivationType, LotListItem, LotOrdemRef } from '~/types/lote'

const ROTULOS: Record<LotActivationType, string> = {
  MANUAL: 'Manual',
  ESGOTAMENTO: 'Após esgotamento',
  DATA_HORA: 'Data e hora'
}

const DESCRICOES: Record<LotActivationType, string> = {
  MANUAL: 'Você ativa o lote quando quiser.',
  ESGOTAMENTO: 'Ativa quando o lote atual esgotar.',
  DATA_HORA: 'Ativa automaticamente na data e hora programadas.'
}

export function rotuloAtivacao(tipo: LotActivationType): string {
  return ROTULOS[tipo]
}

export function descricaoAtivacao(tipo: LotActivationType): string {
  return DESCRICOES[tipo]
}

export function montarAtivacaoEm(data: string, hora: string): string | null {
  if (!data || !hora) return null
  return `${data}T${hora}:00`
}

export function proximaOrdem(lotes: LotListItem[]): number {
  if (lotes.length === 0) return 1
  return Math.max(...lotes.map((lote) => lote.ordem)) + 1
}

export function ordemDuplicada(
  ordens: LotOrdemRef[],
  ordem: number,
  idAtual?: string
): boolean {
  return ordens.some((item) => item.ordem === ordem && item.id !== idAtual)
}
