import { computed, ref } from 'vue'

import { listarCategoriasCaixa, listarContasCaixa } from '~/services/admin/caixa'
import { listarEventosAdmin } from '~/services/admin/eventos'
import type { CategoriaCaixa, ContaCaixa } from '~/types/caixa'
import type { SelectOption } from '~/types/ui'

export interface EventoOpcao {
  id: string
  nome: string
  inicioEm: string
}

/**
 * Dados de apoio do caixa (contas, categorias e eventos), usados pelas telas
 * do Financeiro e pelos formularios de lancamento.
 */
export function useCaixaBase() {
  const contas = ref<ContaCaixa[]>([])
  const categorias = ref<CategoriaCaixa[]>([])
  const eventos = ref<EventoOpcao[]>([])
  const erroBase = ref('')

  async function carregarContas() {
    contas.value = await listarContasCaixa()
  }

  async function carregarCategorias() {
    categorias.value = await listarCategoriasCaixa()
  }

  async function carregarEventos() {
    try {
      const lista = await listarEventosAdmin()
      eventos.value = lista
        .map((e) => ({ id: e.eventoId, nome: e.nome, inicioEm: e.inicioEm }))
        .sort((a, b) => b.inicioEm.localeCompare(a.inicioEm))
    } catch {
      eventos.value = []
    }
  }

  async function carregarBase() {
    erroBase.value = ''
    try {
      await Promise.all([carregarContas(), carregarCategorias(), carregarEventos()])
    } catch {
      erroBase.value =
        'Não foi possível carregar o financeiro. Se for a primeira vez, confira se o SQL do caixa já foi aplicado no Supabase.'
    }
  }

  const contasAtivas = computed(() => contas.value.filter((c) => c.ativa))

  const contaOptions = computed<SelectOption[]>(() =>
    contasAtivas.value.map((c) => ({ value: c.id, label: c.nome }))
  )

  const eventoOptions = computed<SelectOption[]>(() => [
    { value: '', label: 'Nenhum evento' },
    ...eventos.value.map((e) => ({ value: e.id, label: e.nome }))
  ])

  return {
    contas,
    contasAtivas,
    categorias,
    eventos,
    erroBase,
    contaOptions,
    eventoOptions,
    carregarBase,
    carregarContas,
    carregarCategorias,
    carregarEventos
  }
}
