import { paginaInicialPerfil, resolverUid, uidDoUsuario } from '~/utils/auth'

/**
 * Protege a area de acompanhamento das vendas (/acompanhamento).
 * Exige sessao + perfil ACOMPANHAMENTO ativo. Outros perfis vao para a sua
 * propria pagina inicial. A seguranca real esta nas RPCs *_acompanhamento,
 * que so devolvem os eventos ligados ao usuario logado.
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

  if (perfil?.ativo && perfil.perfil === 'ACOMPANHAMENTO') return

  if (perfil?.ativo && ['ADMINISTRADOR', 'PORTARIA', 'PRODUTOR'].includes(perfil.perfil)) {
    return navigateTo(paginaInicialPerfil(perfil.perfil))
  }

  await supabase.auth.signOut()
  return navigateTo('/login?erro=SEM_PERMISSAO')
})
