import type { PublicEventDetail, PublicVendaSituacao } from '~/types/publicEvento'

type DadosSituacao = Pick<
  PublicEventDetail,
  'status' | 'vendasStatus' | 'loteId' | 'disponiveis'
>

/**
 * Regra unica de derivacao da situacao de venda (fora dos templates).
 * Ordem de prioridade alinhada ao dominio publico do GZ1.
 */
export function resolverSituacaoVenda(evento: DadosSituacao): PublicVendaSituacao {
  if (evento.status === 'CANCELADO') return 'CANCELADO'
  if (evento.status === 'REALIZADO') return 'ENCERRADO'
  if (evento.status === 'EM_ANDAMENTO') return 'EVENTO_EM_ANDAMENTO'
  if (evento.vendasStatus === 'ENCERRADAS') return 'VENDAS_ENCERRADAS'
  if (!evento.loteId) return 'SEM_LOTE'
  if (evento.disponiveis === 0) return 'ESGOTADO'
  return 'DISPONIVEL'
}

export function descreverSituacaoVenda(situacao: PublicVendaSituacao): string {
  const mapa: Record<PublicVendaSituacao, string> = {
    DISPONIVEL: 'Vendas abertas',
    ESGOTADO: 'Esgotado',
    SEM_LOTE: 'Em breve',
    VENDAS_ENCERRADAS: 'Vendas encerradas',
    EVENTO_EM_ANDAMENTO: 'Em andamento',
    ENCERRADO: 'Encerrado',
    CANCELADO: 'Cancelado'
  }
  return mapa[situacao]
}
