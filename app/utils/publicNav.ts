export interface PublicNavItem {
  to: string
  label: string
  /** Mostrado como botao em destaque (comprador precisa achar facil). */
  destaque?: boolean
}

/**
 * Itens da navegacao publica (comprador). Fonte unica usada pelo header,
 * garantindo os mesmos destinos em desktop e mobile.
 *
 * Nunca incluir tokens (qr, checkout ou recovery): o acesso aos ingressos
 * passa pelos pedidos salvos no aparelho ou pela validacao de telefone +
 * e-mail em /recuperar-ingressos.
 */
export const PUBLIC_NAV_ITEMS: readonly PublicNavItem[] = [
  { to: '/eventos-publicos', label: 'Eventos' },
  { to: '/recuperar-ingressos', label: 'Meus ingressos', destaque: true }
]
