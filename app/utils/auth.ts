import type { AuthErrorCode, PerfilOperador } from '~/types/operador'

const PERFIS_PERMITIDOS: PerfilOperador[] = ['ADMINISTRADOR', 'PORTARIA']

export function perfilPermitido(perfil: string | null | undefined): boolean {
  return perfil === 'ADMINISTRADOR' || perfil === 'PORTARIA'
}

export type DecisaoAcesso = 'PERMITIR' | 'IR_LOGIN' | 'NEGAR'

/**
 * Decisao pura de acesso a area da portaria (usada pelo middleware).
 * A seguranca real continua no backend/RPC; isto e apenas roteamento/UX.
 */
export function decidirAcessoOperador(input: {
  temSessao: boolean
  perfil: string | null
  ativo: boolean | null
}): DecisaoAcesso {
  if (!input.temSessao) return 'IR_LOGIN'
  if (!perfilPermitido(input.perfil)) return 'NEGAR'
  if (input.ativo !== true) return 'NEGAR'
  return 'PERMITIR'
}

export function mensagemLoginErro(code: AuthErrorCode): string {
  const mapa: Record<AuthErrorCode, string> = {
    CREDENCIAIS_INVALIDAS: 'E-mail ou senha inválidos.',
    SEM_USUARIO: 'Esta conta não está habilitada para a portaria.',
    INATIVO: 'Este usuário está inativo.',
    SEM_PERMISSAO: 'Você não tem permissão para acessar a portaria.',
    ERRO_TEMPORARIO: 'Não foi possível entrar agora. Tente novamente.'
  }
  return mapa[code]
}
