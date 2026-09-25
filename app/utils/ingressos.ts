import type {
  TicketFiltersState,
  TicketListItem,
  TicketSort,
  TicketSummaryData
} from '~/types/ingresso'

export function filtrarIngressos(
  ingressos: TicketListItem[],
  filtros: TicketFiltersState
): TicketListItem[] {
  const busca = filtros.busca.trim().toLowerCase()

  return ingressos.filter((ingresso) => {
    if (busca) {
      const combina =
        ingresso.codigo.toLowerCase().includes(busca) ||
        ingresso.participanteNome.toLowerCase().includes(busca) ||
        ingresso.pedidoCodigo.toLowerCase().includes(busca)
      if (!combina) return false
    }

    if (filtros.eventoId !== 'TODOS' && ingresso.eventoId !== filtros.eventoId) {
      return false
    }

    if (filtros.status !== 'TODOS' && ingresso.status !== filtros.status) {
      return false
    }

    return true
  })
}

export function ordenarIngressos(
  ingressos: TicketListItem[],
  ordenacao: TicketSort
): TicketListItem[] {
  const copia = [...ingressos]

  if (ordenacao === 'PARTICIPANTE_AZ') {
    copia.sort((a, b) => a.participanteNome.localeCompare(b.participanteNome, 'pt-BR'))
    return copia
  }

  copia.sort((a, b) => {
    const diferenca = new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime()
    return ordenacao === 'ANTIGOS' ? diferenca : -diferenca
  })

  return copia
}

export function resumoIngressos(ingressos: TicketListItem[]): TicketSummaryData {
  return ingressos.reduce<TicketSummaryData>(
    (acumulado, ingresso) => {
      acumulado.total += 1

      if (ingresso.status === 'VALIDO') acumulado.validos += 1
      else if (ingresso.status === 'UTILIZADO') acumulado.utilizados += 1
      else if (ingresso.status === 'RESERVADO') acumulado.reservados += 1
      else if (ingresso.status === 'CANCELADO') acumulado.cancelados += 1
      else if (ingresso.status === 'EXPIRADO') acumulado.expirados += 1

      return acumulado
    },
    {
      total: 0,
      validos: 0,
      utilizados: 0,
      reservados: 0,
      cancelados: 0,
      expirados: 0
    }
  )
}

export function gerarPadraoQrMock(semente: string, tamanho = 21): boolean[][] {
  let hash = 0
  for (let indice = 0; indice < semente.length; indice += 1) {
    hash = (hash * 31 + semente.charCodeAt(indice)) >>> 0
  }

  const proximo = () => {
    hash ^= hash << 13
    hash >>>= 0
    hash ^= hash >> 17
    hash ^= hash << 5
    hash >>>= 0
    return hash / 0xffffffff
  }

  const grade: boolean[][] = []

  for (let y = 0; y < tamanho; y += 1) {
    const linha: boolean[] = []

    for (let x = 0; x < tamanho; x += 1) {
      const emTopoEsquerda = x < 7 && y < 7
      const emTopoDireita = x >= tamanho - 7 && y < 7
      const emBaseEsquerda = x < 7 && y >= tamanho - 7

      if (emTopoEsquerda || emTopoDireita || emBaseEsquerda) {
        const localX = emTopoEsquerda ? x : emTopoDireita ? x - (tamanho - 7) : x
        const localY = emBaseEsquerda ? y - (tamanho - 7) : y
        const borda = localX === 0 || localX === 6 || localY === 0 || localY === 6
        const centro = localX >= 2 && localX <= 4 && localY >= 2 && localY <= 4
        linha.push(borda || centro)
      } else {
        linha.push(proximo() > 0.5)
      }
    }

    grade.push(linha)
  }

  return grade
}
