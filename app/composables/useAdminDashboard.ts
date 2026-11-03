import { computed, onMounted, ref, watch } from 'vue'

import { obterDashboardAdmin } from '~/services/admin/dashboard'
import type { AdminDashboardData } from '~/types/dashboard'
import { eventoDoFiltro, mapearDashboard, periodoDoFiltro } from '~/utils/dashboard'

const VAZIO: AdminDashboardData = {
  escopo: { modo: 'atual', dias: null, quantidadeEventos: 0 },
  eventos: [],
  metricas: { vendidos: 0, utilizados: 0, naoEntraram: 0, faturamento: 0, ticketMedio: 0 },
  evento: null,
  entradasPorHora: [],
  pagamentosPorStatus: [],
  pedidosRecentes: [],
  entradasRecentes: []
}

/**
 * Dashboard administrativo: dados reais via RPC + view-models prontos.
 * O filtro vem da URL (?evento=<id> ou ?periodo=todos|7|15|30|90), entao
 * sobrevive ao recarregar. Sem filtro: evento atual.
 */
export function useAdminDashboard() {
  const route = useRoute()
  const eventoFiltro = computed(() => eventoDoFiltro(route.query.evento))
  const periodoFiltro = computed(() => (eventoFiltro.value ? null : periodoDoFiltro(route.query.periodo)))
  const data = ref<AdminDashboardData>(VAZIO)
  const carregando = ref(true)
  const erro = ref('')

  const viewModel = computed(() => mapearDashboard(data.value))

  async function carregar() {
    carregando.value = true
    erro.value = ''
    try {
      data.value = await obterDashboardAdmin({ eventoId: eventoFiltro.value, periodo: periodoFiltro.value })
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

  watch([eventoFiltro, periodoFiltro], () => {
    void carregar()
  })

  return {
    data,
    viewModel,
    eventoFiltro,
    periodoFiltro,
    carregando,
    erro,
    carregar,
    refresh: carregar
  }
}
