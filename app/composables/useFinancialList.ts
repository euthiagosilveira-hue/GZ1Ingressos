import { computed, reactive, ref, watch } from 'vue'

import type {
  FinancialFiltersState,
  FinancialSort,
  PaymentListItem
} from '~/types/pagamento'
import {
  filtrarPagamentos,
  ordenarPagamentos,
  referenciaTemporalPagamentos,
  resumoFinanceiro
} from '~/utils/financeiro'
import { paginar, totalPaginas } from '~/utils/paginacao'

export function useFinancialList(pagamentos: PaymentListItem[], porPagina = 10) {
  const filtros = reactive<FinancialFiltersState>({
    busca: '',
    eventoId: 'TODOS',
    status: 'TODOS',
    periodo: 'TODAS'
  })

  const ordenacao = ref<FinancialSort>('RECENTES')
  const pagina = ref(1)

  const referencia = computed(() => referenciaTemporalPagamentos(pagamentos))

  const pagamentosFiltrados = computed(() =>
    ordenarPagamentos(
      filtrarPagamentos(pagamentos, filtros, referencia.value),
      ordenacao.value
    )
  )

  const total = computed(() => pagamentosFiltrados.value.length)
  const numeroPaginas = computed(() => totalPaginas(total.value, porPagina))
  const pagamentosPaginados = computed(() =>
    paginar(pagamentosFiltrados.value, pagina.value, porPagina)
  )
  const resumo = computed(() => resumoFinanceiro(pagamentosFiltrados.value))

  const temFiltros = computed(
    () =>
      filtros.busca.trim() !== '' ||
      filtros.eventoId !== 'TODOS' ||
      filtros.status !== 'TODOS' ||
      filtros.periodo !== 'TODAS'
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
    filtros.periodo = 'TODAS'
  }

  function irPara(valor: number) {
    pagina.value = Math.min(Math.max(valor, 1), numeroPaginas.value)
  }

  return {
    filtros,
    ordenacao,
    pagina,
    pagamentosFiltrados,
    pagamentosPaginados,
    total,
    numeroPaginas,
    resumo,
    temFiltros,
    limparFiltros,
    irPara
  }
}
