export interface DadosVenda {
  evento: string
  quantidade: number
  valorTotal: number
  comprador: string
}

export interface NotificacaoPush {
  title: string
  body: string
  url: string
  tag?: string
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? ''
}

export function montarNotificacaoVenda(dados: DadosVenda, pedidoId?: string): NotificacaoPush {
  const ingressos = dados.quantidade === 1 ? '1 ingresso' : `${dados.quantidade} ingressos`
  const comprador = primeiroNome(dados.comprador)
  const evento = comprador ? `${dados.evento} · ${comprador}` : dados.evento

  return {
    title: 'Nova venda! 🎟️',
    body: `${ingressos} · ${BRL.format(dados.valorTotal)}\n${evento}`,
    url: '/pedidos',
    tag: pedidoId ? `venda-${pedidoId}` : undefined
  }
}

/** Inscricao expirada/removida pelo navegador: deve ser apagada do banco. */
export function inscricaoExpirada(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410
}

export interface InscricaoRecebida {
  endpoint: string
  p256dh: string
  auth: string
}

/** Valida o corpo de PushSubscription.toJSON() enviado pelo navegador. */
export function validarInscricao(body: unknown): InscricaoRecebida | null {
  const b = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  const endpoint = typeof b?.endpoint === 'string' ? b.endpoint.trim() : ''
  const p256dh = typeof b?.keys?.p256dh === 'string' ? b.keys.p256dh.trim() : ''
  const auth = typeof b?.keys?.auth === 'string' ? b.keys.auth.trim() : ''
  if (!endpoint.startsWith('https://') || endpoint.length > 1000) return null
  if (!p256dh || p256dh.length > 200 || !auth || auth.length > 100) return null
  return { endpoint, p256dh, auth }
}
