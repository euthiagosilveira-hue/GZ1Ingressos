import type {
  EventoAcompanhamentoDetalhe,
  EventoAcompanhamentoItem,
  VendaAcompanhamento
} from '~/types/acompanhamento'
import {
  mapearEventoAcompanhamento,
  mapearEventoAcompanhamentoDetalhe,
  mapearVendaAcompanhamento,
  mensagemErroAcompanhamento
} from '~/utils/acompanhamento'

type Row = Record<string, unknown>

export async function listarEventosAcompanhamento(): Promise<EventoAcompanhamentoItem[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_eventos_acompanhamento')
  if (error) throw new Error(mensagemErroAcompanhamento(error, 'Não foi possível carregar seus eventos.'))
  return ((data as Row[] | null) ?? []).map(mapearEventoAcompanhamento)
}

export async function obterEventoAcompanhamento(eventoId: string): Promise<EventoAcompanhamentoDetalhe> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('obter_evento_acompanhamento', { p_evento_id: eventoId })
  if (error) throw new Error(mensagemErroAcompanhamento(error, 'Não foi possível carregar o evento.'))
  return mapearEventoAcompanhamentoDetalhe(data as Row)
}

export async function listarVendasEventoAcompanhamento(eventoId: string): Promise<VendaAcompanhamento[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_vendas_evento_acompanhamento', { p_evento_id: eventoId })
  if (error) throw new Error(mensagemErroAcompanhamento(error, 'Não foi possível carregar as vendas.'))
  return ((data as Row[] | null) ?? []).map(mapearVendaAcompanhamento)
}
