import { decidirAcessoOperador } from '~/utils/auth'

/**
 * Protege a area da portaria.
 * - sem sessao -> /login
 * - sessao sem usuario/perfil permitido/inativo -> signOut + /login
 * A seguranca real continua no backend (RPCs). Isto e apenas roteamento/UX.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const user = useSupabaseUser()

  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }

  // No servidor apenas garantimos a existencia de sessao; a checagem de perfil
  // acontece no cliente (evita get de perfil durante SSR).
  if (import.meta.server) return

  const { carregarOperador } = useOperatorAuth()
  const perfil = await carregarOperador()

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
