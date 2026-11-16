<script setup lang="ts">
import { computed, ref } from 'vue'

import PageHeader from '~/components/PageHeader.vue'
import SegmentedControl from '~/components/SegmentedControl.vue'
import FinanceiroAbas from '~/components/financeiro/caixa/FinanceiroAbas.vue'
import PedidoSemana from '~/components/financeiro/reposicao/PedidoSemana.vue'
import PedidosAnteriores from '~/components/financeiro/reposicao/PedidosAnteriores.vue'
import ProdutosReposicao from '~/components/financeiro/reposicao/ProdutosReposicao.vue'
import VendasBar from '~/components/financeiro/reposicao/VendasBar.vue'
import type { SelectOption } from '~/types/ui'

// Reposicao semanal de estoque: produtos + pedido da semana + historico.

type Aba = 'pedido' | 'produtos' | 'bar' | 'anteriores'

const route = useRoute()
const router = useRouter()

const abaOptions: SelectOption[] = [
  { value: 'pedido', label: 'Pedido da semana' },
  { value: 'produtos', label: 'Produtos' },
  { value: 'bar', label: 'Vendas do bar' },
  { value: 'anteriores', label: 'Pedidos anteriores' }
]

const aba = computed<Aba>({
  get: () => {
    const q = String(route.query.aba ?? '')
    return q === 'produtos' || q === 'bar' || q === 'anteriores' ? q : 'pedido'
  },
  set: (v) => {
    void router.replace({ query: { ...route.query, aba: v === 'pedido' ? undefined : v } })
  }
})

const chaveAnteriores = ref(0)
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Financeiro" subtitle="Reposição semanal: cadastre o que vocês pedem e monte o pedido da semana." />

    <FinanceiroAbas />

    <SegmentedControl v-model="aba" :options="abaOptions" />

    <!-- v-if: cada aba recarrega ao abrir, assim o pedido ja mostra produtos novos. -->
    <PedidoSemana v-if="aba === 'pedido'" @ir-para-produtos="aba = 'produtos'" @finalizou="chaveAnteriores++" />
    <ProdutosReposicao v-else-if="aba === 'produtos'" />
    <VendasBar v-else-if="aba === 'bar'" />
    <PedidosAnteriores v-else :key="chaveAnteriores" />
  </div>
</template>
