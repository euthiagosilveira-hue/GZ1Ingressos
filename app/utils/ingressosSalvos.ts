/**
 * Lembra no proprio aparelho os pedidos que o comprador abriu (pagamento ou
 * ingressos), para ele voltar em "Meus ingressos" sem precisar de codigo.
 * Guarda so o checkout_token do pedido (o mesmo que ja esta na URL que ele
 * recebeu) e dados de exibicao. Nunca guarda qr_token nem token de recuperacao.
 */

export const CHAVE_INGRESSOS_SALVOS = 'gz1:ingressos-salvos'
export const LIMITE_INGRESSOS_SALVOS = 20

export interface IngressoSalvo {
  checkoutToken: string
  codigoPedido: string
  eventoNome: string
  eventoSlug: string
  eventoInicioEm: string | null
  salvoEm: string
}

/** Subconjunto de Storage usado aqui (facilita teste sem navegador). */
export interface ArmazenamentoSimples {
  getItem(chave: string): string | null
  setItem(chave: string, valor: string): void
}

function ehValido(item: unknown): item is IngressoSalvo {
  if (!item || typeof item !== 'object') return false
  const i = item as Record<string, unknown>
  return typeof i.checkoutToken === 'string' && i.checkoutToken !== '' &&
    typeof i.eventoNome === 'string' && typeof i.codigoPedido === 'string'
}

export function lerIngressosSalvos(storage: ArmazenamentoSimples | null): IngressoSalvo[] {
  if (!storage) return []
  try {
    const bruto = JSON.parse(storage.getItem(CHAVE_INGRESSOS_SALVOS) ?? '[]')
    return Array.isArray(bruto) ? bruto.filter(ehValido) : []
  } catch {
    return []
  }
}

function gravar(storage: ArmazenamentoSimples, lista: IngressoSalvo[]) {
  try {
    storage.setItem(CHAVE_INGRESSOS_SALVOS, JSON.stringify(lista.slice(0, LIMITE_INGRESSOS_SALVOS)))
  } catch {
    // navegador sem espaco ou em modo privado: segue sem lembrar
  }
}

/** Salva (ou atualiza) o pedido no topo da lista, sem duplicar. */
export function salvarIngresso(
  storage: ArmazenamentoSimples | null,
  item: Omit<IngressoSalvo, 'salvoEm'>,
  agora: Date = new Date()
): IngressoSalvo[] {
  if (!storage || !item.checkoutToken) return lerIngressosSalvos(storage)
  const anterior = lerIngressosSalvos(storage).find((i) => i.checkoutToken === item.checkoutToken)
  const novo: IngressoSalvo = {
    ...item,
    eventoInicioEm: item.eventoInicioEm ?? anterior?.eventoInicioEm ?? null,
    salvoEm: anterior?.salvoEm ?? agora.toISOString()
  }
  const lista = [novo, ...lerIngressosSalvos(storage).filter((i) => i.checkoutToken !== item.checkoutToken)]
  gravar(storage, lista)
  return lista.slice(0, LIMITE_INGRESSOS_SALVOS)
}

export function removerIngressoSalvo(
  storage: ArmazenamentoSimples | null,
  checkoutToken: string
): IngressoSalvo[] {
  if (!storage) return []
  const lista = lerIngressosSalvos(storage).filter((i) => i.checkoutToken !== checkoutToken)
  gravar(storage, lista)
  return lista
}

/** localStorage do navegador, ou null no servidor / quando bloqueado. */
export function armazenamentoNavegador(): ArmazenamentoSimples | null {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null
  } catch {
    return null
  }
}
