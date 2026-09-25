<script setup lang="ts">
import { computed } from 'vue'

import BaseSelect from '~/components/BaseSelect.vue'
import OrderEmptyState from '~/components/pedidos/OrderEmptyState.vue'
import OrderFilters from '~/components/pedidos/OrderFilters.vue'
import OrderMobileList from '~/components/pedidos/OrderMobileList.vue'
import OrderPagination from '~/components/pedidos/OrderPagination.vue'
import OrderSummary from '~/components/pedidos/OrderSummary.vue'
import OrderTable from '~/components/pedidos/OrderTable.vue'
import PageHeader from '~/components/PageHeader.vue'
import { useOrderList } from '~/composables/useOrderList'
import { eventosMock } from '~/data/eventos'
import type { SelectOption } from '~/types/ui'
import type { OrderFiltersState, OrderListItem, OrderSort } from '~/types/pedido'

const props = defineProps<{
  pedidos: OrderListItem[]
}>()

const {
  filtros,
  ordenacao,
  pagina,
  pedidosPaginados,
  total,
  numeroPaginas,
  resumo,
  temFiltros,
  limparFiltros,
  irPara
} = useOrderList(props.pedidos, 10)

const eventoOptions = computed<SelectOption[]>(() => [
  { value: 'TODOS', label: 'Todos os eventos' },
  ...eventosMock.map((evento) => ({ value: evento.id, label: evento.nome }))
])

const sortOptions: SelectOption[] = [
  { value: 'RECENTES', label: 'Mais recentes' },
  { value: 'ANTIGOS', label: 'Mais antigos' }
]

const ordenacaoSelecionada = computed({
  get: () => ordenacao.value,
  set: (valor: string) => {
    ordenacao.value = valor as OrderSort
  }
})

function atualizarFiltros(valor: OrderFiltersState) {
  Object.assign(filtros, valor)
}

function acaoPedido(payload: { id: string; action: string }) {
  if (payload.action === 'ingressos') {
    navigateTo(`/pedidos/${payload.id}#order-tickets`)
    return
  }

  if (payload.action === 'pagamento') {
    navigateTo(`/pedidos/${payload.id}#order-payment`)
    return
  }

  navigateTo(`/pedidos/${payload.id}`)
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Pedidos" subtitle="Acompanhe reservas, pagamentos e vendas dos eventos." />

    <OrderSummary :resumo="resumo" />

    <OrderFilters :model-value="filtros" :eventos="eventoOptions" @update:model-value="atualizarFiltros" />

    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-zinc-500">
        {{ total }}
        {{ total === 1 ? 'pedido encontrado' : 'pedidos encontrados' }}
      </p>

      <div class="w-full sm:w-44">
        <BaseSelect v-model="ordenacaoSelecionada" :options="sortOptions" />
      </div>
    </div>

    <OrderEmptyState
      v-if="total === 0"
      :tem-filtros="temFiltros"
      @limpar="limparFiltros"
    />

    <template v-else>
      <div class="hidden lg:block">
        <OrderTable :pedidos="pedidosPaginados" @action="acaoPedido" />
      </div>

      <div class="lg:hidden">
        <OrderMobileList :pedidos="pedidosPaginados" @action="acaoPedido" />
      </div>

      <OrderPagination
        v-if="numeroPaginas > 1"
        :pagina="pagina"
        :total-paginas="numeroPaginas"
        @ir="irPara"
      />
    </template>
  </div>
</template>
