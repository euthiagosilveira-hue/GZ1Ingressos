import type { H3Event } from 'h3'

import { serverSupabaseServiceRole } from '#supabase/server'

import { cifrarToken, decifrarToken } from '../../../utils/mercado-pago-cripto'
import { precisaRenovar, renovarToken, type MpTokenResposta } from './mercado-pago-oauth'

/**
 * Conexao Mercado Pago de cada PRODUTOR (tabela produtores_mercado_pago,
 * acessivel somente pelo service_role). Tokens sempre cifrados em repouso.
 */

interface LinhaConexao {
  produtor_id: string
  mp_user_id: string
  access_token_cifrado: string
  refresh_token_cifrado: string | null
  expira_em: string | null
}

function segredo(event: H3Event): string {
  return String(useRuntimeConfig(event).mercadoPagoTokenKey ?? '')
}

function expiracao(token: MpTokenResposta, agoraMs: number): string | null {
  const segundos = Number(token.expires_in ?? 0)
  if (!segundos || Number.isNaN(segundos)) return null
  return new Date(agoraMs + segundos * 1000).toISOString()
}

export async function salvarConexaoProdutor(
  event: H3Event,
  produtorId: string,
  usuarioId: string,
  token: MpTokenResposta
): Promise<void> {
  const chave = segredo(event)
  const client = serverSupabaseServiceRole(event)
  const { error } = await client.from('produtores_mercado_pago').upsert(
    {
      produtor_id: produtorId,
      mp_user_id: String(token.user_id),
      access_token_cifrado: cifrarToken(token.access_token, chave),
      refresh_token_cifrado: token.refresh_token ? cifrarToken(token.refresh_token, chave) : null,
      public_key: token.public_key ?? null,
      live_mode: Boolean(token.live_mode),
      expira_em: expiracao(token, Date.now()),
      conectado_por_usuario_id: usuarioId,
      conectado_em: new Date().toISOString()
    },
    { onConflict: 'produtor_id' }
  )
  if (error) throw new Error('Falha ao salvar a conexao do Mercado Pago.')

  await client.from('auditoria').insert({
    usuario_id: usuarioId,
    acao: 'MERCADO_PAGO_PRODUTOR_CONECTADO',
    entidade: 'produtores',
    entidade_id: produtorId,
    dados_novos: { mp_user_id: String(token.user_id), live_mode: Boolean(token.live_mode) }
  })
}

/**
 * Access_token (decifrado) do produtor, renovado quando perto de expirar.
 * null quando o produtor nao conectou o Mercado Pago.
 */
export async function obterAccessTokenProdutor(event: H3Event, produtorId: string): Promise<string | null> {
  const chave = segredo(event)
  const client = serverSupabaseServiceRole(event)
  const { data, error } = await client
    .from('produtores_mercado_pago')
    .select('produtor_id,mp_user_id,access_token_cifrado,refresh_token_cifrado,expira_em')
    .eq('produtor_id', produtorId)
    .maybeSingle()

  if (error) throw new Error('Falha ao ler a conexao do Mercado Pago.')
  const linha = data as LinhaConexao | null
  if (!linha) return null

  const accessToken = decifrarToken(linha.access_token_cifrado, chave)
  if (!precisaRenovar(linha.expira_em, Date.now()) || !linha.refresh_token_cifrado) {
    return accessToken
  }

  const config = useRuntimeConfig(event)
  try {
    const novo = await renovarToken({
      clientId: String(config.mercadoPagoClientId ?? ''),
      clientSecret: String(config.mercadoPagoClientSecret ?? ''),
      refreshToken: decifrarToken(linha.refresh_token_cifrado, chave)
    })
    await client
      .from('produtores_mercado_pago')
      .update({
        mp_user_id: String(novo.user_id),
        access_token_cifrado: cifrarToken(novo.access_token, chave),
        refresh_token_cifrado: novo.refresh_token
          ? cifrarToken(novo.refresh_token, chave)
          : linha.refresh_token_cifrado,
        expira_em: expiracao(novo, Date.now())
      })
      .eq('produtor_id', produtorId)
    return novo.access_token
  } catch (erro) {
    // Falha na renovacao: usa o token atual enquanto ainda for valido.
    console.error('[mercado-pago] renovacao de token do produtor falhou', {
      produtorId,
      mensagem: erro instanceof Error ? erro.message : 'erro'
    })
    return accessToken
  }
}
