import type { AdminEventListItem, EventFiltersState, EventListItem } from '~/types/evento'

/** Adapta o item administrativo real para o shape usado pelos cards. */
export function mapearEventoAdminParaListItem(evento: AdminEventListItem): EventListItem {
  return {
    id: evento.eventoId,
    nome: evento.nome,
    slug: evento.slug,
    imagemUrl: null,
    inicioEm: evento.inicioEm,
    local: evento.local,
    status: evento.status,
    vendasStatus: evento.vendasStatus,
    publicacaoStatus: evento.publicacaoStatus,
    loteAtual: null,
    vendidos: evento.ingressosCount,
    disponiveis: 0
  }
}

export function filtrarEventos(
  eventos: EventListItem[],
  filtros: EventFiltersState
): EventListItem[] {
  const busca = filtros.busca.trim().toLowerCase()

  return eventos.filter((evento) => {
    if (busca) {
      const combina =
        evento.nome.toLowerCase().includes(busca) ||
        evento.local.toLowerCase().includes(busca)
      if (!combina) return false
    }

    if (filtros.status !== 'TODOS' && evento.status !== filtros.status) {
      return false
    }

    if (
      filtros.publicacao !== 'TODOS' &&
      evento.publicacaoStatus !== filtros.publicacao
    ) {
      return false
    }

    return true
  })
}

export function gerarSlug(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function montarInicioEm(data: string, hora: string): string {
  if (!data || !hora) return ''
  return `${data}T${hora}:00`
}
