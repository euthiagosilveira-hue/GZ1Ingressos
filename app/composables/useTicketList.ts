import { computed, reactive, ref, watch } from 'vue'

import type {
  TicketFiltersState,
  TicketListItem,
  TicketSort
} from '~/types/ingresso'
import { filtrarIngressos, ordenarIngressos, resumoIngressos } from '~/utils/ingressos'
import { paginar, totalPaginas } from '~/utils/paginacao'

export function useTicketList(ingressos: TicketListItem[], porPagina = 10) {
  const filtros = reactive<TicketFiltersState>({
    busca: '',
    eventoId: 'TODOS',
    status: 'TODOS'
  })

  const ordenacao = ref<TicketSort>('RECENTES')
  const pagina = ref(1)

  const ingressosFiltrados = computed(() =>
    ordenarIngressos(filtrarIngressos(ingressos, filtros), ordenacao.value)
  )

  const total = computed(() => ingressosFiltrados.value.length)
  const numeroPaginas = computed(() => totalPaginas(total.value, porPagina))
  const ingressosPaginados = computed(() =>
    paginar(ingressosFiltrados.value, pagina.value, porPagina)
  )
  const resumo = computed(() => resumoIngressos(ingressosFiltrados.value))

  const temFiltros = computed(
    () =>
      filtros.busca.trim() !== '' ||
      filtros.eventoId !== 'TODOS' ||
      filtros.status !== 'TODOS'
  )

  watch(filtros, () => {
    pagina.value = 1
  })

  watch(ordenacao, () => {
    pagina.value = 1
  })

  watch(numeroPaginas, (maximo) => {
    if (pagina.value > maximo) pagina.value = maximo
  })

  function limparFiltros() {
    filtros.busca = ''
    filtros.eventoId = 'TODOS'
    filtros.status = 'TODOS'
  }

  function irPara(valor: number) {
    pagina.value = Math.min(Math.max(valor, 1), numeroPaginas.value)
  }

  return {
    filtros,
    ordenacao,
    pagina,
    ingressosFiltrados,
    ingressosPaginados,
    total,
    numeroPaginas,
    resumo,
    temFiltros,
    limparFiltros,
    irPara
  }
}
