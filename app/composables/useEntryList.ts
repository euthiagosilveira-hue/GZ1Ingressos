import { computed, reactive, ref, watch } from 'vue'

import type { EntryFiltersState, EntryListItem, EntrySort } from '~/types/entrada'
import {
  filtrarEntradas,
  ordenarEntradas,
  referenciaTemporal,
  resumoEntradas
} from '~/utils/entradas'
import { paginar, totalPaginas } from '~/utils/paginacao'

export function useEntryList(entradas: EntryListItem[], porPagina = 10) {
  const itens = ref<EntryListItem[]>(entradas.map((entrada) => ({ ...entrada })))

  const filtros = reactive<EntryFiltersState>({
    busca: '',
    eventoId: 'TODOS',
    metodo: 'TODOS',
    situacao: 'TODOS',
    periodo: 'TODAS'
  })

  const ordenacao = ref<EntrySort>('RECENTES')
  const pagina = ref(1)

  const referencia = computed(() => referenciaTemporal(itens.value))

  const entradasFiltradas = computed(() =>
    ordenarEntradas(
      filtrarEntradas(itens.value, filtros, referencia.value),
      ordenacao.value
    )
  )

  const total = computed(() => entradasFiltradas.value.length)
  const numeroPaginas = computed(() => totalPaginas(total.value, porPagina))
  const entradasPaginadas = computed(() =>
    paginar(entradasFiltradas.value, pagina.value, porPagina)
  )
  const resumo = computed(() => resumoEntradas(entradasFiltradas.value))

  const temFiltros = computed(
    () =>
      filtros.busca.trim() !== '' ||
      filtros.eventoId !== 'TODOS' ||
      filtros.metodo !== 'TODOS' ||
      filtros.situacao !== 'TODOS' ||
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
    filtros.metodo = 'TODOS'
    filtros.situacao = 'TODOS'
    filtros.periodo = 'TODAS'
  }

  function irPara(valor: number) {
    pagina.value = Math.min(Math.max(valor, 1), numeroPaginas.value)
  }

  function anularEntrada(id: string, motivo: string) {
    const agora = new Date().toISOString()

    itens.value = itens.value.map((entrada) =>
      entrada.id === id && !entrada.anuladaEm
        ? {
            ...entrada,
            anuladaEm: agora,
            anuladaPorUsuarioId: 'usr_admin_001',
            anuladaPorUsuarioNome: 'Administrador',
            motivoAnulacao: motivo.trim()
          }
        : entrada
    )
  }

  return {
    itens,
    filtros,
    ordenacao,
    pagina,
    entradasFiltradas,
    entradasPaginadas,
    total,
    numeroPaginas,
    resumo,
    temFiltros,
    limparFiltros,
    irPara,
    anularEntrada
  }
}
