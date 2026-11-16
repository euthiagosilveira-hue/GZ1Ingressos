import type { H3Event } from 'h3'

import { chamarGemini, hojeSaoPaulo } from '../../utils/gemini'
import {
  type AvisoCaixa,
  type DadosResumoCaixa,
  type TextoResumo,
  chaveResumo,
  corpoPedidoResumo,
  interpretarResumo,
  notificacaoAvisos,
  notificacaoResumo,
  resumoSemIa,
  tituloResumo,
  ultimaSemanaFechada
} from '../../utils/resumo-caixa'
import { notificarAdmins } from '../push/push-service'

// Monitor do caixa: confere o caixa (regras no banco) e escreve o resumo da
// semana (numeros do banco + texto do Gemini). Chamado pelo agendamento do
// banco (/api/sistema/monitor-caixa) ou pelo botao da tela (resumo).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = any

export async function verificarAvisosCaixa(event: H3Event, client: Cliente) {
  const { data, error } = await client.rpc('gerar_financeiro_alertas_sistema')
  if (error) {
    console.error('[monitor-caixa] erro ao gerar avisos', error.message)
    throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  }
  const avisos = (data ?? []) as AvisoCaixa[]
  const notificacao = notificacaoAvisos(avisos)
  if (notificacao) {
    const envio = await notificarAdmins(event, notificacao, 'PUSH_CAIXA_AVISOS', 'financeiro_alertas', avisos.length === 1 ? avisos[0]!.id : null)
    if (envio?.enviadas) {
      await client
        .from('financeiro_alertas')
        .update({ push_enviado_em: new Date().toISOString() })
        .in('id', avisos.map((a) => a.id))
    }
  }
  console.info('[monitor-caixa] avisos', { novos: avisos.length })
  return { novos: avisos.length }
}

async function escreverTexto(event: H3Event, dados: DadosResumoCaixa): Promise<TextoResumo & { ia: boolean }> {
  const chave = String(useRuntimeConfig(event).geminiApiKey || '')
  if (chave) {
    try {
      const { texto } = await chamarGemini(event, chave, corpoPedidoResumo(dados), 'resumo-caixa')
      const lido = interpretarResumo(texto)
      if (lido) return { ...lido, ia: true }
      console.warn('[monitor-caixa] resposta da IA vazia, usando resumo simples')
    } catch (erro) {
      console.warn('[monitor-caixa] IA indisponivel, usando resumo simples', (erro as Error)?.message)
    }
  }
  return { ...resumoSemIa(dados), ia: false }
}

/**
 * Gera (ou refaz) o resumo da ultima semana fechada e guarda em
 * financeiro_alertas. Com enviarPush, avisa os administradores.
 */
export async function gerarResumoSemanal(event: H3Event, client: Cliente, opcoes: { enviarPush: boolean }) {
  const { de, ate } = ultimaSemanaFechada(hojeSaoPaulo())
  const { data, error } = await client.rpc('dados_resumo_financeiro_sistema', { p_de: de, p_ate: ate })
  if (error || !data) {
    console.error('[monitor-caixa] erro ao ler dados do resumo', error?.message)
    throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  }
  const dados = data as DadosResumoCaixa
  const texto = await escreverTexto(event, dados)
  const titulo = tituloResumo(de, ate)

  const { data: salvo, error: erroSalvar } = await client
    .from('financeiro_alertas')
    .upsert(
      {
        tipo: 'RESUMO_SEMANAL',
        chave: chaveResumo(de),
        titulo,
        mensagem: `${texto.manchete}\n\n${texto.texto}`,
        dados: { de, ate, ia: texto.ia, manchete: texto.manchete },
        atualizado_em: new Date().toISOString()
      },
      { onConflict: 'chave' }
    )
    .select('id')
    .single()
  if (erroSalvar) {
    console.error('[monitor-caixa] erro ao salvar resumo', erroSalvar.message)
    throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  }

  if (opcoes.enviarPush) {
    const envio = await notificarAdmins(event, notificacaoResumo(de, ate, texto.manchete), 'PUSH_CAIXA_RESUMO', 'financeiro_alertas', salvo?.id ?? null)
    if (envio?.enviadas && salvo?.id) {
      await client.from('financeiro_alertas').update({ push_enviado_em: new Date().toISOString() }).eq('id', salvo.id)
    }
  }
  console.info('[monitor-caixa] resumo', { de, ate, ia: texto.ia })
  return { id: salvo?.id ?? null, de, ate, ia: texto.ia }
}
