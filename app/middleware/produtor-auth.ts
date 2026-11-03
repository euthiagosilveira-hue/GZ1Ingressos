import { paginaInicialPerfil, resolverUid, uidDoUsuario } from '~/utils/auth'

/**
 * Protege a area do produtor (/produtor).
 * Exige sessao + perfil PRODUTOR ativo. Equipe (admin/portaria) e levada para
 * a sua propria pagina inicial. A seguranca real esta nas RPCs *_produtor,
 * que so devolvem os eventos ligados ao produtor logado.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  const session = useSupabaseSession()
  const supabase = useSupabaseClient()

  let uid = resolverUid(uidDoUsuario(user.value), session.value?.user?.id)

  if (!uid && import.meta.client) {
    try {
      const { data } = await supabase.auth.getSession()
      uid = data.session?.user?.id ?? null
    } catch {
      uid = null
    }
  }

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

  if (perfil?.ativo && perfil.perfil === 'PRODUTOR') return

  if (perfil?.ativo && (perfil.perfil === 'ADMINISTRADOR' || perfil.perfil === 'PORTARIA')) {
    return navigateTo(paginaInicialPerfil(perfil.perfil))
  }

  await supabase.auth.signOut()
  return navigateTo('/login?erro=SEM_PERMISSAO')
})
