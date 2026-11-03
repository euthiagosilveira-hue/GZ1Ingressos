import { serverSupabaseUser } from '#supabase/server'

import { exigirAdmin } from '../../../../utils/admin-auth'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Cria o login do produtor (ADMINISTRADOR ativo).
 *
 * Envia o convite oficial do Supabase Auth para o e-mail do produtor, cria
 * public.usuarios com perfil PRODUTOR e liga produtores.usuario_id.
 * Se algo falhar depois do convite, remove o auth user (sem estado parcial).
 * O produtor so enxerga os eventos em que esta na sociedade (RPCs *_produtor).
 */
export default defineEventHandler(async (event) => {
  const produtorId = String(getRouterParam(event, 'id') ?? '').trim()
  if (!UUID.test(produtorId)) {
    setResponseStatus(event, 400)
    return { error: 'DADOS_INVALIDOS' }
  }

  const admin = await exigirAdmin(event)
  const claims = await serverSupabaseUser(event).catch(() => null)
  const solicitante = claims?.sub ? String(claims.sub) : null

  const { data: produtor, error: erroProdutor } = await admin
    .from('produtores')
    .select('id,nome,email,usuario_id,ativo')
    .eq('id', produtorId)
    .maybeSingle()
  if (erroProdutor) {
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }
  if (!produtor || !produtor.ativo) {
    setResponseStatus(event, 404)
    return { error: 'NAO_ENCONTRADO', message: 'Produtor não encontrado.' }
  }
  if (produtor.usuario_id) {
    setResponseStatus(event, 409)
    return { error: 'JA_TEM_ACESSO', message: 'Este produtor já tem acesso.' }
  }

  const email = String(produtor.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    setResponseStatus(event, 400)
    return { error: 'SEM_EMAIL', message: 'Cadastre um e-mail válido para o produtor.' }
  }

  const { data: existente } = await admin
    .from('usuarios')
    .select('id')
    .ilike('email', email)
    .maybeSingle()
  if (existente) {
    setResponseStatus(event, 409)
    return { error: 'EMAIL_DUPLICADO', message: 'Já existe um usuário com este e-mail.' }
  }

  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl || getRequestURL(event).origin).replace(/\/+$/, '')
  const nome = String(produtor.nome).trim().slice(0, 120)

  const { data: convite, error: erroConvite } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { nome, perfil: 'PRODUTOR' },
    redirectTo: `${siteUrl}/auth/convite`
  })
  if (erroConvite || !convite?.user) {
    const mensagem = (erroConvite?.message ?? '').toLowerCase()
    if (mensagem.includes('already') || mensagem.includes('registered') || mensagem.includes('exists')) {
      setResponseStatus(event, 409)
      return { error: 'EMAIL_DUPLICADO', message: 'Já existe um usuário com este e-mail.' }
    }
    setResponseStatus(event, 502)
    return { error: 'FALHA_CONVITE', message: 'Não foi possível enviar o convite.' }
  }

  const novoUsuarioId = convite.user.id

  const { error: erroUsuario } = await admin
    .from('usuarios')
    .upsert({ id: novoUsuarioId, nome, email, perfil: 'PRODUTOR', ativo: true }, { onConflict: 'id' })

  const { data: vinculado, error: erroVinculo } = erroUsuario
    ? { data: null, error: erroUsuario }
    : await admin
        .from('produtores')
        .update({ usuario_id: novoUsuarioId, atualizado_em: new Date().toISOString() })
        .eq('id', produtorId)
        .is('usuario_id', null)
        .select('id')
        .maybeSingle()

  if (erroUsuario || erroVinculo || !vinculado) {
    // Compensacao: nada fica pela metade.
    await admin.from('usuarios').delete().eq('id', novoUsuarioId)
    await admin.auth.admin.deleteUser(novoUsuarioId).catch(() => {})
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }

  await admin.from('auditoria').insert({
    usuario_id: solicitante,
    acao: 'PRODUTOR_ACESSO_CRIADO',
    entidade: 'produtores',
    entidade_id: produtorId,
    dados_novos: { usuario_id: novoUsuarioId, email, perfil: 'PRODUTOR' }
  })

  return { ok: true }
})
