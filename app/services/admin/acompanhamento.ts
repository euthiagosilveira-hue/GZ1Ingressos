import type { Acompanhante } from '~/types/acompanhamento'
import { mapearAcompanhante, mensagemErroAcompanhamento } from '~/utils/acompanhamento'

type Row = Record<string, unknown>

function mensagemAdmin(error: { code?: string; message?: string } | null, padrao: string): string {
  if (error?.code === '42501') return 'Você não tem permissão para gerenciar o acompanhamento.'
  return mensagemErroAcompanhamento(error, padrao)
}

/** Quem acompanha as vendas deste evento (ADMINISTRADOR). */
export async function listarAcompanhantesEventoAdmin(eventoId: string): Promise<Acompanhante[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_acompanhantes_evento_admin', { p_evento_id: eventoId })
  if (error) throw new Error(mensagemAdmin(error, 'Não foi possível carregar quem acompanha o evento.'))
  return ((data as Row[] | null) ?? []).map(mapearAcompanhante)
}

/** Todas as pessoas com login de acompanhamento (ADMINISTRADOR). */
export async function listarAcompanhantesAdmin(): Promise<Acompanhante[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_acompanhantes_admin')
  if (error) throw new Error(mensagemAdmin(error, 'Não foi possível carregar os acompanhantes.'))
  return ((data as Row[] | null) ?? []).map(mapearAcompanhante)
}

/**
 * Adiciona alguem ao acompanhamento do evento. E-mail novo recebe convite
 * para criar a senha; e-mail que ja tem acesso de acompanhamento so e ligado.
 */
export async function adicionarAcompanhanteEventoAdmin(
  eventoId: string,
  nome: string,
  email: string
): Promise<{ conviteEnviado: boolean }> {
  let resposta: Response
  try {
    resposta = await fetch(`/api/admin/eventos/${encodeURIComponent(eventoId)}/acompanhantes`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email })
    })
  } catch {
    throw new Error('Sem conexão. Verifique a internet e tente de novo.')
  }
  const corpo = (await resposta.json().catch(() => ({}))) as {
    ok?: boolean
    conviteEnviado?: boolean
    message?: string
    statusMessage?: string
  }
  if (!resposta.ok || !corpo.ok) {
    if (resposta.status === 403) throw new Error('Você não tem permissão para gerenciar o acompanhamento.')
    throw new Error(corpo.message || 'Não foi possível adicionar a pessoa.')
  }
  return { conviteEnviado: Boolean(corpo.conviteEnviado) }
}

/** Tira o acesso da pessoa a este evento (auditado). O login continua existindo. */
export async function removerAcompanhanteEventoAdmin(eventoId: string, usuarioId: string): Promise<void> {
  const client = useSupabaseClient()
  const { error } = await client.rpc('remover_acompanhante_evento_admin', {
    p_evento_id: eventoId,
    p_usuario_id: usuarioId
  })
  if (error) throw new Error(mensagemAdmin(error, 'Não foi possível tirar o acesso.'))
}
