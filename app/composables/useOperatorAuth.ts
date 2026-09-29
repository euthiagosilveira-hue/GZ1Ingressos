import { computed, ref } from 'vue'

import { obterOperadorAtual } from '~/services/auth/operador'
import type { AuthErrorCode, OperadorProfile } from '~/types/operador'
import { mensagemLoginErro, perfilPermitido } from '~/utils/auth'

export class AuthError extends Error {
  code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(mensagemLoginErro(code))
    this.name = 'AuthError'
    this.code = code
  }
}

/**
 * Autenticacao do operador da portaria (Supabase Auth) + perfil em
 * public.usuarios. A autorizacao real permanece no backend/RPC.
 */
export function useOperatorAuth() {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const operador = useState<OperadorProfile | null>('operator-profile', () => null)
  const carregando = ref(false)
  const carregado = useState<boolean>('operator-profile-loaded', () => false)

  const isAuthorized = computed(
    () => Boolean(operador.value && operador.value.ativo && perfilPermitido(operador.value.perfil))
  )

  async function carregarOperador(): Promise<OperadorProfile | null> {
    const atual = user.value
    if (!atual) {
      operador.value = null
      carregado.value = true
      return null
    }
    try {
      const perfil = await obterOperadorAtual(atual.id)
      operador.value = perfil
      return perfil
    } finally {
      carregado.value = true
    }
  }

  async function login(email: string, senha: string): Promise<OperadorProfile> {
    carregando.value = true
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha
      })
      if (error) throw new AuthError('CREDENCIAIS_INVALIDAS')

      const perfil = await carregarOperador()
      if (!perfil) {
        await supabase.auth.signOut()
        throw new AuthError('SEM_USUARIO')
      }
      if (!perfil.ativo) {
        await supabase.auth.signOut()
        throw new AuthError('INATIVO')
      }
      if (!perfilPermitido(perfil.perfil)) {
        await supabase.auth.signOut()
        throw new AuthError('SEM_PERMISSAO')
      }
      return perfil
    } catch (e) {
      if (e instanceof AuthError) throw e
      throw new AuthError('ERRO_TEMPORARIO')
    } finally {
      carregando.value = false
    }
  }

  async function logout(): Promise<void> {
    await supabase.auth.signOut()
    operador.value = null
    carregado.value = false
  }

  return {
    user,
    operador,
    carregando,
    carregado,
    isAuthorized,
    login,
    logout,
    carregarOperador,
    refreshProfile: carregarOperador
  }
}
