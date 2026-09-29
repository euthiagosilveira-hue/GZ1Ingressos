import { resolverUid } from '~/utils/auth'

/**
 * Protege a area administrativa (/eventos etc.).
 * Exige sessao + perfil ADMINISTRADOR ativo.
 * Nao quebra /portaria (que usa operator-auth).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  const session = useSupabaseSession()

  const uid = resolverUid(user.value?.id, session.value?.user?.id)
  if (!uid) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  if (import.meta.server) return

  const { carregarOperador } = useOperatorAuth()

  let perfil = null
  try {
    perfil = await carregarOperador(uid)
  } catch {
    return
  }

  if (!perfil || !perfil.ativo || perfil.perfil !== 'ADMINISTRADOR') {
    const supabase = useSupabaseClient()
    await supabase.auth.signOut()
    return navigateTo('/login?erro=SEM_PERMISSAO')
  }
})
