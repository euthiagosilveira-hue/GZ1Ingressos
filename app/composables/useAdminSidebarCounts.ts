import { onMounted, ref, watch } from 'vue'

import { obterContadoresAdmin } from '~/services/admin/sidebar'

/**
 * Contadores reais dos badges do sidebar. Carrega ao entrar no layout admin e
 * atualiza a cada navegacao. Em qualquer falha mantem null (badge oculto):
 * melhor nao exibir do que exibir um numero incorreto.
 */
export function useAdminSidebarCounts() {
  const route = useRoute()
  const pedidos = ref<number | null>(null)
  const entradas = ref<number | null>(null)

  async function carregar() {
    try {
      const contadores = await obterContadoresAdmin()
      pedidos.value = contadores?.pedidos ?? null
      entradas.value = contadores?.entradas ?? null
    } catch {
      pedidos.value = null
      entradas.value = null
    }
  }

  onMounted(() => {
    void carregar()
  })

  watch(
    () => route.fullPath,
    () => {
      void carregar()
    }
  )

  return { pedidos, entradas, carregar }
}
