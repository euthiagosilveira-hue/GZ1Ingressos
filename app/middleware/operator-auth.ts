import { decidirAcessoOperador, resolverUid } from '~/utils/auth'

/**
 * Protege a area da portaria.
 * - sem sessao real -> /login
 * - sessao sem perfil permitido/inativo -> signOut + /login
 * Nao derruba a sessao por atraso reativo (usa uid explicito) nem por erro
 * transitorio de consulta. A seguranca real continua no backend (RPCs).
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()
  const session = useSupabaseSession()

  // uid vem da sessao/user real (nao depende do ref reativo estar hidratado).
  const uid = resolverUid(user.value?.id, session.value?.user?.id)
  if (!uid) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // No servidor apenas garantimos a existencia de sessao.
  if (import.meta.server) return

  const { carregarOperador } = useOperatorAuth()

  let perfil = null
  try {
    perfil = await carregarOperador(uid)
  } catch {
    // Erro transitorio: nao derruba a sessao; a pagina pode tentar de novo.
    return
  }

  const decisao = decidirAcessoOperador({
    temSessao: true,
    perfil: perfil?.perfil ?? null,
    ativo: perfil?.ativo ?? null
  })

  if (decisao !== 'PERMITIR') {
    const supabase = useSupabaseClient()
    await supabase.auth.signOut()
    return navigateTo('/login?erro=SEM_PERMISSAO')
  }
})
