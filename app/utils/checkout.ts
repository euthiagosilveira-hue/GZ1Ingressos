import type { CheckoutDraft, CheckoutReservationMock } from '~/types/checkout'
import type { PublicEventDetail } from '~/types/publicEvento'

export const CHECKOUT_MIN = 1
export const CHECKOUT_MAX = 10
export const RESERVA_MINUTOS = 15

export function limiteQuantidade(disponiveis: number | null): number {
  if (disponiveis === null) return CHECKOUT_MAX
  return Math.max(CHECKOUT_MIN, Math.min(CHECKOUT_MAX, disponiveis))
}

export function nomeValido(valor: string): boolean {
  return valor.trim().length >= 2
}

export function normalizarTelefone(valor: string): string {
  return valor.replace(/\D/g, '')
}

export function telefoneValido(valor: string): boolean {
  const digitos = normalizarTelefone(valor)
  return digitos.length === 10 || digitos.length === 11
}

export function formatarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 11)
  if (digitos.length === 0) return ''
  if (digitos.length <= 2) return `(${digitos}`
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`
}

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim())
}

/** Gerador de codigo mock (nao usa a sequence real do banco). */
export function gerarCodigoPedidoMock(): string {
  return `GZ${Math.floor(100000 + Math.random() * 900000)}`
}

/** ISO de expiracao da reserva (fonte de verdade = Date/ISO). */
export function calcularExpiracao(minutos = RESERVA_MINUTOS, base = new Date()): string {
  return new Date(base.getTime() + minutos * 60_000).toISOString()
}

export function criarReservaMock(
  evento: PublicEventDetail,
  draft: CheckoutDraft
): CheckoutReservationMock {
  const valorUnitario = evento.preco ?? 0
  return {
    pedidoId: `mock-reserva-${Date.now()}`,
    codigo: gerarCodigoPedidoMock(),
    eventoId: evento.eventoId,
    loteId: evento.loteId ?? '',
    quantidade: draft.quantidade,
    valorUnitario,
    valorTotal: valorUnitario * draft.quantidade,
    expiraEm: calcularExpiracao(),
    status: 'RESERVADO'
  }
}
