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

const TZ_EVENTO = 'America/Sao_Paulo'

/** Offset (minutos) de America/Sao_Paulo no instante informado (DST-safe). */
function offsetSaoPauloEmMinutos(instante: Date): number {
  const formatador = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_EVENTO,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  const partes = formatador.formatToParts(instante)
  const mapa: Record<string, string> = {}
  for (const parte of partes) mapa[parte.type] = parte.value
  const comoUtc = Date.UTC(
    Number(mapa.year),
    Number(mapa.month) - 1,
    Number(mapa.day),
    Number(mapa.hour) % 24,
    Number(mapa.minute),
    Number(mapa.second)
  )
  return Math.round((comoUtc - instante.getTime()) / 60000)
}

/**
 * Interpreta data (YYYY-MM-DD) + hora (HH:MM) como horario de America/Sao_Paulo
 * e retorna o instante inequivoco em ISO 8601 UTC (com Z).
 * Nunca envia timestamp "naive" sem offset.
 */
export function montarInicioEm(data: string, hora: string): string {
  if (!data || !hora) return ''

  const [ano, mes, dia] = data.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  if ([ano, mes, dia, h, min].some((n) => Number.isNaN(n))) return ''

  // Palpite inicial: trata o horario de parede como UTC e corrige pelo offset.
  const paredeComoUtc = Date.UTC(ano, mes - 1, dia, h, min, 0)
  let offset = offsetSaoPauloEmMinutos(new Date(paredeComoUtc))
  let instante = paredeComoUtc - offset * 60000
  // Recalcula o offset no instante real (bordas de mudanca de horario).
  offset = offsetSaoPauloEmMinutos(new Date(instante))
  instante = paredeComoUtc - offset * 60000

  return new Date(instante).toISOString()
}
