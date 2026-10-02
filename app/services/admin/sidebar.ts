import type { SidebarCounts } from '~/utils/sidebar'
import { mapearContadoresAdmin } from '~/utils/sidebar'

/** Contadores agregados e leves para os badges do sidebar (RPC ADMIN). */
export async function obterContadoresAdmin(): Promise<SidebarCounts | null> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('obter_contadores_admin')
  if (error) {
    throw new Error('Não foi possível carregar os contadores do menu.')
  }
  return mapearContadoresAdmin(data)
}
