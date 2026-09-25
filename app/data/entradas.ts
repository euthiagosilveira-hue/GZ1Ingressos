import { ingressosMock } from '~/data/ingressos'
import type { EntryListItem, EntryMethod } from '~/types/entrada'

interface Operador {
  id: string
  nome: string
}

const ADMINISTRADOR: Operador = { id: 'usr_admin_001', nome: 'Administrador' }

const operadores: Operador[] = [
  { id: 'usr_oper_001', nome: 'Carlos Almeida' },
  { id: 'usr_oper_002', nome: 'Marina Souza' },
  ADMINISTRADOR
]

const motivos = [
  'Entrada registrada por engano.',
  'Leitura duplicada na portaria.',
  'Ingresso apresentado incorretamente.'
]

function somarMinutos(iso: string, minutos: number): string {
  return new Date(new Date(iso).getTime() + minutos * 60_000).toISOString()
}

function anular(entrada: EntryListItem, motivo: string): EntryListItem {
  return {
    ...entrada,
    anuladaEm: somarMinutos(entrada.entradaEm, 30),
    anuladaPorUsuarioId: ADMINISTRADOR.id,
    anuladaPorUsuarioNome: ADMINISTRADOR.nome,
    motivoAnulacao: motivo
  }
}

function derivarEntradas(): EntryListItem[] {
  const pagos = ingressosMock.filter(
    (ingresso) => ingresso.status === 'VALIDO' || ingresso.status === 'UTILIZADO'
  )

  const baseAnulada = new Set([7, 15])
  const extraAnulada = new Set([3, 10, 17, 21])

  const entradas: EntryListItem[] = []

  pagos.forEach((ingresso, indice) => {
    const operador = operadores[indice % operadores.length]
    const metodo: EntryMethod = indice % 3 === 0 ? 'NOME' : 'QR_CODE'
    const entradaEm = ingresso.utilizadoEm ?? somarMinutos(ingresso.criadoEm, (indice + 1) * 37)

    const base: EntryListItem = {
      id: `ent_${ingresso.id}`,
      ingressoId: ingresso.id,
      ingressoCodigo: ingresso.codigo,
      participanteNome: ingresso.participanteNome,
      pedidoId: ingresso.pedidoId,
      pedidoCodigo: ingresso.pedidoCodigo,
      eventoId: ingresso.eventoId,
      eventoNome: ingresso.eventoNome,
      usuarioId: operador.id,
      usuarioNome: operador.nome,
      metodo,
      entradaEm,
      anuladaEm: null,
      anuladaPorUsuarioId: null,
      anuladaPorUsuarioNome: null,
      motivoAnulacao: null,
      criadoEm: entradaEm
    }

    entradas.push(baseAnulada.has(indice) ? anular(base, motivos[indice % motivos.length]) : base)

    if (extraAnulada.has(indice)) {
      const extraOperador = operadores[(indice + 1) % operadores.length]
      const horarioExtra = somarMinutos(entradaEm, -20)

      const extra: EntryListItem = {
        ...base,
        id: `ent_${ingresso.id}_extra`,
        usuarioId: extraOperador.id,
        usuarioNome: extraOperador.nome,
        metodo: metodo === 'QR_CODE' ? 'NOME' : 'QR_CODE',
        entradaEm: horarioExtra,
        criadoEm: horarioExtra
      }

      entradas.push(anular(extra, motivos[(indice + 1) % motivos.length]))
    }
  })

  return entradas
}

export const entradasMock: EntryListItem[] = derivarEntradas()
