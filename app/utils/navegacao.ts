export type PerfilNavegacao = 'ADMINISTRADOR' | 'PORTARIA' | null

/**
 * A gestao da Lista VIP e administrativa: apenas ADMINISTRADOR.
 * PORTARIA usa VIP somente pela /portaria (busca + entrada).
 */
export function podeVerListaVip(perfil: PerfilNavegacao): boolean {
  return perfil === 'ADMINISTRADOR'
}
