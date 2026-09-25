import { computed, reactive, ref, watch } from 'vue'

import type {
  OrderFiltersState,
  OrderListItem,
  OrderSort
} from '~/types/pedido'
import {
  filtrarPedidos,
  ordenarPedidos,
  resumoPedidos
} from '~/utils/pedidos'
import { paginar, totalPaginas } from '~/utils/paginacao'

export function useOrderList(pedidos: OrderListItem[], porPagina = 10) {
  const filtros = reactive<OrderFiltersState>({
    busca: '',
    eventoId: 'TODOS',
    status: 'TODOS',
    tipoPreco: 'TODOS'
  })

  const ordenacao = ref<OrderSort>('RECENTES')
  const pagina = ref(1)

  const pedidosFiltrados = computed(() =>
    ordenarPedidos(filtrarPedidos(pedidos, filtros), ordenacao.value)
  )

  const total = computed(() => pedidosFiltrados.value.length)
  const numeroPaginas = computed(() => totalPaginas(total.value, porPagina))
  const pedidosPaginados = computed(() =>
    paginar(pedidosFiltrados.value, pagina.value, porPagina)
  )
  const resumo = computed(() => resumoPedidos(pedidosFiltrados.value))

  const temFiltros = computed(
    () =>
      filtros.busca.trim() !== '' ||
      filtros.eventoId !== 'TODOS' ||
      filtros.status !== 'TODOS' ||
      filtros.tipoPreco !== 'TODOS'
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
    filtros.tipoPreco = 'TODOS'
  }

  function irPara(valor: number) {
    pagina.value = Math.min(Math.max(valor, 1), numeroPaginas.value)
  }

  return {
    filtros,
    ordenacao,
    pagina,
    pedidosFiltrados,
    pedidosPaginados,
    total,
    numeroPaginas,
    resumo,
    temFiltros,
    limparFiltros,
    irPara
  }
}
