export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function combinaNome(participante: string, termo: string): boolean {
  const alvo = normalizarTexto(termo)
  if (!alvo) return false
  return normalizarTexto(participante).includes(alvo)
}
