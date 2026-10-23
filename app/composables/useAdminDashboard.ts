import { computed, onMounted, ref, watch } from 'vue'

import { obterDashboardAdmin } from '~/services/admin/dashboard'
import type { AdminDashboardData } from '~/types/dashboard'
import { eventoDoFiltro, mapearDashboard } from '~/utils/dashboard'

const VAZIO: AdminDashboardData = {
  metricas: { vendidos: 0, utilizados: 0, naoEntraram: 0, faturamento: 0, ticketMedio: 0 },
  evento: null,
  entradasPorHora: [],
  pagamentosPorStatus: [],
  pedidosRecentes: [],
  entradasRecentes: []
}

/**
 * Dashboard administrativo: dados reais via RPC + view-models prontos.
 * O filtro por evento vem da URL (?evento=<id>), entao sobrevive ao recarregar.
 */
export function useAdminDashboard() {
  const route = useRoute()
  const eventoFiltro = computed(() => eventoDoFiltro(route.query.evento))
  const data = ref<AdminDashboardData>(VAZIO)
  const carregando = ref(true)
  const erro = ref('')

  const viewModel = computed(() => mapearDashboard(data.value))

  async function carregar() {
    carregando.value = true
    erro.value = ''
    try {
      data.value = await obterDashboardAdmin(eventoFiltro.value)
    } catch {
      erro.value = 'Não foi possível carregar o dashboard.'
      data.value = VAZIO
    } finally {
      carregando.value = false
    }
  }

  onMounted(() => {
    void carregar()
  })

  watch(eventoFiltro, () => {
    void carregar()
  })

  return {
    data,
    viewModel,
    eventoFiltro,
    carregando,
    erro,
    carregar,
    refresh: carregar
  }
}
