import { computed, ref } from 'vue'

import type { EventListItem, EventStatus } from '~/types/evento'
import type { TicketListItem, TicketStatus } from '~/types/ingresso'
import type {
  GateCheckinMethod,
  GateMode,
  GateRecentEntry,
  GateSimulationOption,
  GateValidationResultData
} from '~/types/portaria'
import { combinaNome } from '~/utils/portaria'

const STATUS_OPERACIONAIS: EventStatus[] = ['AGENDADO', 'EM_ANDAMENTO']

export function useGate(todosIngressos: TicketListItem[], todosEventos: EventListItem[]) {
  const ingressos = ref<TicketListItem[]>(todosIngressos.map((item) => ({ ...item })))

  const eventosOperacionais = computed(() =>
    todosEventos.filter((evento) => STATUS_OPERACIONAIS.includes(evento.status))
  )

  const eventoId = ref('')
  const modo = ref<GateMode>('QR')
  const busca = ref('')
  const metodoValidacao = ref<GateCheckinMethod>('QR_CODE')
  const resultado = ref<GateValidationResultData | null>(null)
  const entradasRecentes = ref<GateRecentEntry[]>([])

  const eventoAtual = computed(
    () => eventosOperacionais.value.find((evento) => evento.id === eventoId.value) ?? null
  )

  const ingressosDoEvento = computed(() =>
    ingressos.value.filter((item) => item.eventoId === eventoId.value)
  )

  const resultadosBusca = computed(() => {
    const termo = busca.value.trim()
    if (!termo || !eventoId.value) return []
    return ingressosDoEvento.value
      .filter((item) => combinaNome(item.participanteNome, termo))
      .slice(0, 20)
  })

  const opcoesSimulacao = computed<GateSimulationOption[]>(() => {
    const opcoes: GateSimulationOption[] = []
    if (!eventoId.value) return opcoes

    const porStatus = (status: TicketStatus) =>
      ingressosDoEvento.value.find((item) => item.status === status)

    const casos: Array<{ status: TicketStatus; rotulo: string }> = [
      { status: 'VALIDO', rotulo: 'Ingresso válido' },
      { status: 'UTILIZADO', rotulo: 'Já utilizado' },
      { status: 'RESERVADO', rotulo: 'Reservado' },
      { status: 'EXPIRADO', rotulo: 'Expirado' },
      { status: 'CANCELADO', rotulo: 'Cancelado' }
    ]

    casos.forEach((caso) => {
      const ingresso = porStatus(caso.status)
      if (ingresso) {
        opcoes.push({
          id: ingresso.id,
          rotulo: caso.rotulo,
          codigo: ingresso.codigo,
          valida: true
        })
      }
    })

    const outroEvento = ingressos.value.find(
      (item) => item.eventoId !== eventoId.value && item.status === 'VALIDO'
    )
    if (outroEvento) {
      opcoes.push({
        id: outroEvento.id,
        rotulo: 'Evento incorreto',
        codigo: outroEvento.codigo,
        valida: true
      })
    }

    opcoes.push({
      id: 'codigo_invalido',
      rotulo: 'Código inválido',
      codigo: '—',
      valida: false
    })

    return opcoes
  })

  function montarInvalido(): GateValidationResultData {
    return { status: 'INVALIDO', ingresso: null, eventoCorretoNome: null, utilizadoEm: null }
  }

  function montarResultado(ingresso: TicketListItem): GateValidationResultData {
    const eventoCorreto =
      todosEventos.find((evento) => evento.id === ingresso.eventoId) ?? null

    if (ingresso.eventoId !== eventoId.value) {
      return {
        status: 'EVENTO_INCORRETO',
        ingresso,
        eventoCorretoNome: eventoCorreto?.nome ?? null,
        utilizadoEm: null
      }
    }

    if (ingresso.status === 'VALIDO') {
      return { status: 'VALIDO', ingresso, eventoCorretoNome: null, utilizadoEm: null }
    }
    if (ingresso.status === 'UTILIZADO') {
      return {
        status: 'JA_UTILIZADO',
        ingresso,
        eventoCorretoNome: null,
        utilizadoEm: ingresso.utilizadoEm
      }
    }
    if (ingresso.status === 'RESERVADO') {
      return { status: 'RESERVADO', ingresso, eventoCorretoNome: null, utilizadoEm: null }
    }
    if (ingresso.status === 'CANCELADO') {
      return { status: 'CANCELADO', ingresso, eventoCorretoNome: null, utilizadoEm: null }
    }

    return { status: 'EXPIRADO', ingresso, eventoCorretoNome: null, utilizadoEm: null }
  }

  function selecionarEvento(id: string) {
    eventoId.value = id
    resultado.value = null
    busca.value = ''
  }

  function definirModo(novoModo: GateMode) {
    modo.value = novoModo
    resultado.value = null
    busca.value = ''
  }

  function atualizarBusca(valor: string) {
    busca.value = valor
  }

  function validarPorId(id: string) {
    const ingresso = ingressos.value.find((item) => item.id === id) ?? null
    if (!ingresso) {
      resultado.value = montarInvalido()
      return
    }
    metodoValidacao.value = 'NOME'
    resultado.value = montarResultado(ingresso)
  }

  function simularLeitura(id: string) {
    if (id === 'codigo_invalido') {
      resultado.value = montarInvalido()
      return
    }

    const ingresso = ingressos.value.find((item) => item.id === id) ?? null
    if (!ingresso) {
      resultado.value = montarInvalido()
      return
    }

    metodoValidacao.value = 'QR_CODE'
    resultado.value = montarResultado(ingresso)
  }

  function registrarEntrada() {
    const atual = resultado.value
    if (!atual || atual.status !== 'VALIDO' || !atual.ingresso) return

    const agora = new Date().toISOString()
    const alvo = atual.ingresso

    ingressos.value = ingressos.value.map((item) =>
      item.id === alvo.id ? { ...item, status: 'UTILIZADO', utilizadoEm: agora } : item
    )

    entradasRecentes.value = [
      {
        id: `${alvo.id}_${agora}`,
        ingressoId: alvo.id,
        codigo: alvo.codigo,
        participanteNome: alvo.participanteNome,
        metodo: metodoValidacao.value,
        registradoEm: agora
      },
      ...entradasRecentes.value
    ].slice(0, 50)

    resultado.value = {
      status: 'LIBERADO',
      ingresso: { ...alvo, status: 'UTILIZADO', utilizadoEm: agora },
      eventoCorretoNome: null,
      utilizadoEm: agora
    }
  }

  function validarProximo() {
    resultado.value = null
    busca.value = ''
  }

  return {
    eventosOperacionais,
    eventoId,
    eventoAtual,
    modo,
    busca,
    resultado,
    entradasRecentes,
    resultadosBusca,
    opcoesSimulacao,
    selecionarEvento,
    definirModo,
    atualizarBusca,
    validarPorId,
    simularLeitura,
    registrarEntrada,
    validarProximo
  }
}
