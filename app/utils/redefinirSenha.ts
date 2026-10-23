export const LINK_REDEFINICAO_INVALIDO_MSG =
  'Este link de redefinição expirou ou já foi utilizado. Solicite um novo link.'

/**
 * Mensagem neutra exibida apos pedir o link: nao revela se o e-mail
 * existe ou nao (evita enumeracao de contas).
 */
export const PEDIDO_REDEFINICAO_ENVIADO_MSG =
  'Se este e-mail estiver cadastrado, você receberá em instantes um link para criar uma nova senha. Verifique também a caixa de spam.'

/** URL para onde o link do e-mail leva (precisa estar liberada no Supabase). */
export function urlRedefinicao(siteUrl: string | null | undefined, origemAtual: string): string {
  const base = String(siteUrl || origemAtual).replace(/\/+$/, '')
  return `${base}/auth/redefinir-senha`
}
