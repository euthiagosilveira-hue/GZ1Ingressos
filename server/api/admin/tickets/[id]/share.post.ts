import { createHash, randomBytes } from 'node:crypto'

import { exigirAdmin, lerIngressoIdDaRota } from '../../../../utils/admin-auth'

/**
 * Gera um link publico (/ingresso/<token>) de UM ingresso para o admin
 * enviar ao comprador (ex.: WhatsApp). Mesmo formato do compartilhamento
 * do comprador: token de 256 bits, so o hash md5 fica no banco.
 * Nao revoga links anteriores, para nao invalidar o que o comprador ja tem.
 */
export default defineEventHandler(async (event) => {
  const ingressoId = lerIngressoIdDaRota(event)
  const admin = await exigirAdmin(event)

  const { data: ingresso, error } = await admin
    .from('ingressos')
    .select('id,status,participante_nome,pedido_id,evento_id')
    .eq('id', ingressoId)
    .maybeSingle()

  if (error) {
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }
  if (!ingresso) {
    setResponseStatus(event, 404)
    return { error: 'NAO_ENCONTRADO' }
  }
  if (ingresso.status !== 'VALIDO') {
    setResponseStatus(event, 409)
    return { error: 'INGRESSO_INDISPONIVEL' }
  }

  const [{ data: pedido }, { data: evento }] = await Promise.all([
    admin.from('pedidos').select('comprador_telefone').eq('id', ingresso.pedido_id).maybeSingle(),
    admin.from('eventos').select('nome').eq('id', ingresso.evento_id).maybeSingle()
  ])

  const token = randomBytes(32).toString('hex')
  const { error: erroInsert } = await admin.from('compartilhamentos_ingresso').insert({
    ingresso_id: ingresso.id,
    token_hash: createHash('md5').update(token).digest('hex')
  })

  if (erroInsert) {
    setResponseStatus(event, 500)
    return { error: 'ERRO_INESPERADO' }
  }

  const config = useRuntimeConfig(event)
  const siteUrl = String(config.public.siteUrl || getRequestURL(event).origin).replace(/\/+$/, '')

  return {
    shareUrl: `${siteUrl}/ingresso/${token}`,
    telefone: pedido?.comprador_telefone ?? null,
    participanteNome: ingresso.participante_nome,
    eventoNome: evento?.nome ?? ''
  }
})
