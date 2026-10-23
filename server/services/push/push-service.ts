import type { H3Event } from 'h3'
import webpush from 'web-push'

import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

import { inscricaoExpirada, montarNotificacaoVenda, type NotificacaoPush } from './push-mensagem'

interface InscricaoBanco {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

function configurarVapid(event: H3Event): boolean {
  const config = useRuntimeConfig(event)
  const publica = String(config.public.vapidPublicKey || '')
  const privada = String(config.vapidPrivateKey || '')
  if (!publica || !privada) return false
  const subject = String(config.vapidSubject || config.public.siteUrl || 'https://gz-1-ingressos.vercel.app')
  webpush.setVapidDetails(subject, publica, privada)
  return true
}

/** Usuario logado que e ADMINISTRADOR ativo, ou null. */
export async function obterAdminAtivo(event: H3Event): Promise<string | null> {
  const claims = await serverSupabaseUser(event).catch(() => null)
  const uid = claims?.sub ? String(claims.sub) : ''
  if (!uid) return null

  const { data } = await serverSupabaseServiceRole(event)
    .from('usuarios')
    .select('perfil,ativo')
    .eq('id', uid)
    .maybeSingle()

  return data?.ativo && data.perfil === 'ADMINISTRADOR' ? uid : null
}

async function enviarPara(event: H3Event, inscricoes: InscricaoBanco[], notificacao: NotificacaoPush): Promise<number> {
  if (!inscricoes.length || !configurarVapid(event)) return 0

  const payload = JSON.stringify(notificacao)
  const expiradas: string[] = []
  let enviadas = 0

  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          payload,
          { TTL: 60 * 60 * 6, urgency: 'high', timeout: 8000 }
        )
        enviadas++
      } catch (erro) {
        const statusCode = (erro as { statusCode?: number }).statusCode
        if (inscricaoExpirada(statusCode)) expiradas.push(i.id)
        else console.error('[push] falha ao enviar', { statusCode })
      }
    })
  )

  if (expiradas.length) {
    await serverSupabaseServiceRole(event).from('push_inscricoes').delete().in('id', expiradas)
  }
  return enviadas
}

async function inscricoesDeAdmins(event: H3Event, usuarioId?: string): Promise<InscricaoBanco[]> {
  let query = serverSupabaseServiceRole(event)
    .from('push_inscricoes')
    .select('id,endpoint,p256dh,auth,usuarios!inner(perfil,ativo)')
    .eq('usuarios.perfil', 'ADMINISTRADOR')
    .eq('usuarios.ativo', true)
  if (usuarioId) query = query.eq('usuario_id', usuarioId)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as InscricaoBanco[]
}

/**
 * Avisa os administradores que uma venda online foi paga.
 * Nunca lanca erro: falha de notificacao nao pode quebrar a confirmacao do pagamento.
 */
export async function notificarVendaConfirmada(event: H3Event, pedidoId: string): Promise<void> {
  try {
    const client = serverSupabaseServiceRole(event)
    const { data: pedido, error } = await client
      .from('pedidos')
      .select('quantidade,valor_total,comprador_nome,eventos(nome)')
      .eq('id', pedidoId)
      .maybeSingle()
    if (error || !pedido) return

    const evento = (pedido.eventos as { nome?: string } | null)?.nome ?? 'Evento'
    const notificacao = montarNotificacaoVenda(
      {
        evento,
        quantidade: Number(pedido.quantidade),
        valorTotal: Number(pedido.valor_total),
        comprador: String(pedido.comprador_nome ?? '')
      },
      pedidoId
    )

    await enviarPara(event, await inscricoesDeAdmins(event), notificacao)
  } catch (erro) {
    console.error('[push] erro ao notificar venda', { pedidoId, message: (erro as Error)?.message })
  }
}

/** Envia uma notificacao de teste para os aparelhos do proprio usuario. */
export async function enviarTeste(event: H3Event, usuarioId: string): Promise<number> {
  return enviarPara(event, await inscricoesDeAdmins(event, usuarioId), {
    title: 'Notificações ativadas ✅',
    body: 'Você vai receber um aviso aqui a cada venda online confirmada.',
    url: '/configuracoes',
    tag: 'teste'
  })
}

export function pushConfigurado(event: H3Event): boolean {
  return configurarVapid(event)
}
