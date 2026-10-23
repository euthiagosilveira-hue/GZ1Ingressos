import { normalizarCodigoPedido, normalizarEmail, normalizarTelefone } from '~/utils/publicIngressos'

export interface RecuperacaoResultado {
  ok: boolean
  token: string | null
  expiraEm: string | null
}

interface RecuperacaoRpc {
  ok?: boolean
  token?: string | null
  expira_em?: string | null
}

/**
 * Gera um token temporario de recuperacao a partir de codigo do pedido +
 * telefone. A validacao e 100% server-side; a resposta e sempre generica.
 */
export async function recuperarIngressos(input: {
  codigo: string
  telefone: string
}): Promise<RecuperacaoResultado> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('recuperar_ingressos', {
    p_codigo: normalizarCodigoPedido(input.codigo),
    p_telefone: normalizarTelefone(input.telefone)
  })
  if (error) {
    throw new Error('Não foi possível recuperar agora. Tente novamente.')
  }
  const r = (data ?? {}) as RecuperacaoRpc
  return {
    ok: r.ok === true,
    token: r.token ?? null,
    expiraEm: r.expira_em ?? null
  }
}

export interface PedidoRecuperado {
  token: string
  expiraEm: string | null
  codigoPedido: string
  eventoNome: string
  eventoInicioEm: string | null
  quantidade: number
}

interface PedidoRecuperadoRpc {
  token?: string | null
  expira_em?: string | null
  codigo_pedido?: string | null
  evento_nome?: string | null
  evento_inicio_em?: string | null
  quantidade?: number | null
}

/**
 * Recupera os pedidos pagos a partir do telefone + e-mail usados na compra
 * (o comprador nao precisa do codigo). Devolve um token temporario por
 * pedido; a resposta e generica quando nada confere.
 */
export async function recuperarIngressosPorContato(input: {
  telefone: string
  email: string
}): Promise<PedidoRecuperado[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('recuperar_ingressos_contato', {
    p_telefone: normalizarTelefone(input.telefone),
    p_email: normalizarEmail(input.email)
  })
  if (error) {
    throw new Error('Não foi possível recuperar agora. Tente novamente.')
  }
  const r = (data ?? {}) as { ok?: boolean; pedidos?: PedidoRecuperadoRpc[] | null }
  if (r.ok !== true) return []
  return (r.pedidos ?? [])
    .filter((p) => !!p.token)
    .map((p) => ({
      token: p.token as string,
      expiraEm: p.expira_em ?? null,
      codigoPedido: p.codigo_pedido ?? '',
      eventoNome: p.evento_nome ?? '',
      eventoInicioEm: p.evento_inicio_em ?? null,
      quantidade: p.quantidade ?? 0
    }))
}
