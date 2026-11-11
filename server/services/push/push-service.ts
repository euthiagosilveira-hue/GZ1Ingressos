import type { H3Event } from 'h3'
import webpush from 'web-push'

import { serverSupabaseServiceRole, serverSupabaseUser } from '#supabase/server'

import { inscricaoExpirada, montarNotificacaoVenda, type NotificacaoPush } from './push-mensagem'

interface InscricaoBanco {
  id: string
  usuario_id?: string
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

export interface ResultadoEnvio {
  configurado: boolean
  aparelhos: number
  enviadas: number
  /** Aparelhos removidos porque o navegador cancelou a inscricao (404/410). */
  removidas: number
  /** Falhas que nao sao inscricao expirada (ex.: 403 chave/assinatura recusada). */
  falhas: { usuario_id: string | null; aparelho: string; status: number | null; motivo: string }[]
}

/** Nome curto do servico de push (Apple, Google...) para diagnostico. */
function servicoDoAparelho(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'desconhecido'
  }
}

async function enviarPara(
  event: H3Event,
  inscricoes: InscricaoBanco[],
  notificacao: NotificacaoPush
): Promise<ResultadoEnvio> {
  const resultado: ResultadoEnvio = {
    configurado: configurarVapid(event),
    aparelhos: inscricoes.length,
    enviadas: 0,
    removidas: 0,
    falhas: []
  }
  if (!inscricoes.length || !resultado.configurado) return resultado

  const payload = JSON.stringify(notificacao)
  const expiradas: string[] = []

  await Promise.all(
    inscricoes.map(async (i) => {
      try {
        await webpush.sendNotification(
          { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
          payload,
          { TTL: 60 * 60 * 6, urgency: 'high', timeout: 8000 }
        )
        resultado.enviadas++
      } catch (erro) {
        const e = erro as { statusCode?: number; body?: unknown; message?: string }
        if (inscricaoExpirada(e.statusCode)) {
          expiradas.push(i.id)
          return
        }
        const motivo = String(e.body || e.message || 'erro').slice(0, 200)
        resultado.falhas.push({
          usuario_id: i.usuario_id ?? null,
          aparelho: servicoDoAparelho(i.endpoint),
          status: e.statusCode ?? null,
          motivo
        })
        console.error('[push] falha ao enviar', { statusCode: e.statusCode, motivo })
      }
    })
  )

  if (expiradas.length) {
    await serverSupabaseServiceRole(event).from('push_inscricoes').delete().in('id', expiradas)
    resultado.removidas = expiradas.length
  }
  return resultado
}

/** Registra na auditoria o resultado de um envio (diagnostico pelo banco). */
async function registrarEnvio(
  event: H3Event,
  acao: string,
  entidade: string,
  entidadeId: string | null,
  r: ResultadoEnvio
) {
  try {
    await serverSupabaseServiceRole(event).from('auditoria').insert({
      acao,
      entidade,
      entidade_id: entidadeId,
      dados_novos: r
    })
  } catch {
    // Diagnostico nunca derruba o fluxo principal.
  }
}

async function inscricoesDeAdmins(event: H3Event, usuarioId?: string): Promise<InscricaoBanco[]> {
  let query = serverSupabaseServiceRole(event)
    .from('push_inscricoes')
    .select('id,usuario_id,endpoint,p256dh,auth,usuarios!inner(perfil,ativo)')
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

    const resultado = await enviarPara(event, await inscricoesDeAdmins(event), notificacao)
    await registrarEnvio(event, 'PUSH_VENDA', 'pedidos', pedidoId, resultado)
  } catch (erro) {
    console.error('[push] erro ao notificar venda', { pedidoId, message: (erro as Error)?.message })
  }
}

/** Envia uma notificacao de teste para os aparelhos do proprio usuario. */
export async function enviarTeste(event: H3Event, usuarioId: string): Promise<ResultadoEnvio> {
  const resultado = await enviarPara(event, await inscricoesDeAdmins(event, usuarioId), {
    title: 'Notificações ativadas ✅',
    body: 'Você vai receber um aviso aqui a cada venda online confirmada.',
    url: '/configuracoes',
    tag: 'teste'
  })
  await registrarEnvio(event, 'PUSH_TESTE', 'push_inscricoes', null, resultado)
  return resultado
}

export function pushConfigurado(event: H3Event): boolean {
  return configurarVapid(event)
}
