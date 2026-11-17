import { serverSupabaseUser } from '#supabase/server'

import { exigirAdmin } from '../../../../utils/admin-auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LIMITE_NOME = 120

/**
 * Adiciona alguem para ACOMPANHAR as vendas de um evento (ADMINISTRADOR ativo).
 *
 * Body: { nome, email }.
 *   - E-mail que ja e de um usuario ACOMPANHAMENTO: so liga ao evento (sem convite).
 *   - E-mail novo: envia o convite oficial do Supabase Auth, cria public.usuarios
 *     com perfil ACOMPANHAMENTO e liga ao evento. Se algo falhar depois do
 *     convite, remove o auth user (sem estado parcial).
 *   - E-mail de admin/portaria/produtor: recusado (esses perfis tem outra area).
 *
 * O acompanhante so enxerga os eventos ligados a ele (RPCs *_acompanhamento),
 * somente leitura e sem telefone/e-mail dos compradores.
 */
export default defineEventHandler(async (event) => {
  const eventoId = String(getRouterParam(event, 'id') ?? '').trim()
  if (!UUID.test(eventoId)) {
    setResponseStatus(event, 400)
    return { error: 'DADOS_INVALIDOS' }
  }

  const admin = await exigirAdmin(event)
  const claims = await serverSupabaseUser(event).catch(() => null)
  const solicitante = claims?.sub ? String(claims.sub) : null

  const body = await readBody<{ nome?: string; email?: string }>(event).catch(() => ({}))
  const nome = String(body?.nome ?? '').trim().slice(0, LIMITE_NOME)
  const email = String(body?.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    setResponseStatus(event, 400)
    return { error: 'DADOS_INVALIDOS', message: 'Informe um e-mail válido.' }
  }

  const { data: evento, error: erroEvento } = await admin
    .from('eventos')
    .select('id')
    .eq('id', eventoId)
    .maybeSingle()
  if (erroEvento) {
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }
  if (!evento) {
    setResponseStatus(event, 404)
    return { error: 'NAO_ENCONTRADO', message: 'Evento não encontrado.' }
  }

  const { data: existente, error: erroExistente } = await admin
    .from('usuarios')
    .select('id,perfil,ativo,nome')
    .ilike('email', email)
    .maybeSingle()
  if (erroExistente) {
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }

  let usuarioId: string
  let convidado = false

  if (existente) {
    if (existente.perfil !== 'ACOMPANHAMENTO') {
      setResponseStatus(event, 409)
      return {
        error: 'OUTRO_PERFIL',
        message: 'Este e-mail já é de um usuário da equipe ou de um produtor. Use outro e-mail.'
      }
    }
    if (!existente.ativo) {
      setResponseStatus(event, 409)
      return {
        error: 'INATIVO',
        message: 'Este usuário está inativo. Ative em Configurações › Usuários e tente de novo.'
      }
    }
    usuarioId = String(existente.id)
  } else {
    if (!nome) {
      setResponseStatus(event, 400)
      return { error: 'DADOS_INVALIDOS', message: 'Informe o nome da pessoa.' }
    }

    const config = useRuntimeConfig(event)
    const siteUrl = String(config.public.siteUrl || getRequestURL(event).origin).replace(/\/+$/, '')
    const { data: convite, error: erroConvite } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { nome, perfil: 'ACOMPANHAMENTO' },
      redirectTo: `${siteUrl}/auth/convite`
    })
    if (erroConvite || !convite?.user) {
      const mensagem = (erroConvite?.message ?? '').toLowerCase()
      if (mensagem.includes('already') || mensagem.includes('registered') || mensagem.includes('exists')) {
        setResponseStatus(event, 409)
        return { error: 'EMAIL_DUPLICADO', message: 'Já existe um login com este e-mail.' }
      }
      setResponseStatus(event, 502)
      return { error: 'FALHA_CONVITE', message: 'Não foi possível enviar o convite.' }
    }

    usuarioId = convite.user.id
    convidado = true

    const { error: erroUsuario } = await admin
      .from('usuarios')
      .upsert({ id: usuarioId, nome, email, perfil: 'ACOMPANHAMENTO', ativo: true }, { onConflict: 'id' })
    if (erroUsuario) {
      await admin.auth.admin.deleteUser(usuarioId).catch(() => {})
      setResponseStatus(event, 500)
      return { error: 'ERRO_INESPERADO' }
    }
  }

  const { error: erroVinculo } = await admin
    .from('eventos_acompanhantes')
    .upsert(
      { evento_id: eventoId, usuario_id: usuarioId, criado_por: solicitante },
      { onConflict: 'evento_id,usuario_id', ignoreDuplicates: true }
    )
  if (erroVinculo) {
    if (convidado) {
      // Compensacao: nada fica pela metade.
      await admin.from('usuarios').delete().eq('id', usuarioId)
      await admin.auth.admin.deleteUser(usuarioId).catch(() => {})
    }
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }

  await admin.from('auditoria').insert({
    usuario_id: solicitante,
    acao: 'ACOMPANHANTE_ADICIONADO',
    entidade: 'eventos',
    entidade_id: eventoId,
    dados_novos: { usuario_id: usuarioId, email, convite_enviado: convidado }
  })

  return { ok: true, conviteEnviado: convidado }
})
