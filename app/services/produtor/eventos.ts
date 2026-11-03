import { mapearSociedade } from '~/services/admin/sociedade'
import type {
  EventoProdutorDetalhe,
  EventoProdutorItem,
  VendaProdutor,
  VipProdutor
} from '~/types/produtor'

interface RpcErrorLike {
  code?: string
  message?: string
}

type Row = Record<string, unknown>

function mensagemErro(error: RpcErrorLike | null, padrao: string): string {
  const mensagem = (error?.message ?? '').toLowerCase()
  if (error?.code === '42501' && mensagem.includes('adicionados por voce')) {
    return 'Você só pode remover convidados que você mesmo adicionou.'
  }
  if (error?.code === '42501' || mensagem.includes('permiss')) {
    return 'Seu acesso de produtor não está ativo. Fale com a galeria.'
  }
  if (mensagem.includes('evento nao encontrado')) return 'Evento não encontrado.'
  if (mensagem.includes('informe o nome')) return 'Informe o nome do convidado.'
  if (mensagem.includes('muito longo')) return 'Nome muito longo.'
  if (mensagem.includes('evento encerrado')) return 'O evento já foi encerrado: a lista VIP não pode mais ser alterada.'
  if (mensagem.includes('ja entrou')) return 'Esse convidado já entrou e não pode ser removido.'
  return padrao
}

function numero(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function mapearItem(r: Row): EventoProdutorItem {
  return {
    eventoId: String(r.evento_id),
    nome: String(r.nome ?? ''),
    slug: String(r.slug ?? ''),
    imagemUrl: texto(r.imagem_url),
    inicioEm: String(r.inicio_em ?? ''),
    local: texto(r.local),
    status: String(r.status ?? ''),
    vendasStatus: texto(r.vendas_status),
    publicacaoStatus: texto(r.publicacao_status),
    percentualGaleria: numero(r.percentual_galeria),
    percentualProdutor: numero(r.percentual_produtor),
    vendidos: numero(r.vendidos)
  }
}

export async function listarEventosProdutor(): Promise<EventoProdutorItem[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_eventos_produtor')
  if (error) throw new Error(mensagemErro(error, 'Não foi possível carregar seus eventos.'))
  return ((data as Row[] | null) ?? []).map(mapearItem)
}

export async function obterEventoProdutor(eventoId: string): Promise<EventoProdutorDetalhe> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('obter_evento_produtor', { p_evento_id: eventoId })
  if (error) throw new Error(mensagemErro(error, 'Não foi possível carregar o evento.'))
  const r = data as Row
  const lote = r.lote_ativo as Row | null
  const totais = mapearSociedade({
    evento_id: String(r.evento_id),
    ativa: true,
    totais: r.totais as Record<string, number | string>
  }).totais!
  return {
    ...mapearItem(r),
    capacidadeTotal: r.capacidade_total == null ? null : numero(r.capacidade_total),
    produtorNome: String(r.produtor_nome ?? ''),
    utilizados: numero(r.utilizados),
    vipTotal: numero(r.vip_total),
    vipEntraram: numero(r.vip_entraram),
    loteAtivo: lote ? { nome: String(lote.nome ?? ''), preco: numero(lote.preco) } : null,
    totais
  }
}

export async function listarVendasEventoProdutor(eventoId: string): Promise<VendaProdutor[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_vendas_evento_produtor', { p_evento_id: eventoId })
  if (error) throw new Error(mensagemErro(error, 'Não foi possível carregar as vendas.'))
  return ((data as Row[] | null) ?? []).map((r) => ({
    codigo: String(r.codigo ?? ''),
    compradorNome: String(r.comprador_nome ?? ''),
    quantidade: numero(r.quantidade),
    valorTotal: numero(r.valor_total),
    forma: r.forma === 'PORTARIA' ? 'PORTARIA' : 'ONLINE',
    pagoEm: texto(r.pago_em)
  }))
}

export async function listarVipProdutor(eventoId: string): Promise<VipProdutor[]> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('listar_vip_produtor', { p_evento_id: eventoId })
  if (error) throw new Error(mensagemErro(error, 'Não foi possível carregar a lista VIP.'))
  return ((data as Row[] | null) ?? []).map((r) => ({
    vipId: String(r.vip_id),
    nome: String(r.nome ?? ''),
    observacao: texto(r.observacao),
    entrou: Boolean(r.entrou),
    entradaEm: texto(r.entrada_em),
    adicionadoPorMim: Boolean(r.adicionado_por_mim)
  }))
}

export async function adicionarVipProdutor(
  eventoId: string,
  nome: string,
  observacao: string | null
): Promise<void> {
  const client = useSupabaseClient()
  const { error } = await client.rpc('adicionar_vip_produtor', {
    p_evento_id: eventoId,
    p_nome: nome,
    p_observacao: observacao
  })
  if (error) throw new Error(mensagemErro(error, 'Não foi possível adicionar o convidado.'))
}

export async function removerVipProdutor(vipId: string): Promise<void> {
  const client = useSupabaseClient()
  const { error } = await client.rpc('remover_vip_produtor', { p_vip_id: vipId })
  if (error) throw new Error(mensagemErro(error, 'Não foi possível remover o convidado.'))
}

/** Baixa a lista de pagantes (sem telefone) de um evento do produtor. */
export async function baixarListaPagantesProdutor(
  eventoId: string,
  formato: 'xlsx' | 'txt'
): Promise<void> {
  let resposta: Response
  try {
    resposta = await fetch(
      `/api/produtor/eventos/${encodeURIComponent(eventoId)}/pagantes?formato=${formato}`,
      { credentials: 'same-origin' }
    )
  } catch {
    throw new Error('Sem conexão. Verifique a internet e tente de novo.')
  }
  if (!resposta.ok) throw new Error('Não foi possível gerar a lista de pagantes.')

  const disposicao = resposta.headers.get('Content-Disposition') ?? ''
  const nome = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? `pagantes.${formato}`
  const url = URL.createObjectURL(await resposta.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface StatusMercadoPagoProdutor {
  conectado: boolean
  conectadoEm: string | null
  liveMode: boolean
}

/** Se a conta Mercado Pago do produtor logado esta conectada. */
export async function obterStatusMercadoPagoProdutor(): Promise<StatusMercadoPagoProdutor> {
  const client = useSupabaseClient()
  const { data, error } = await client.rpc('status_mercado_pago_produtor')
  if (error) throw new Error(mensagemErro(error, 'Não foi possível ver a conexão do Mercado Pago.'))
  const r = (data ?? {}) as Row
  return {
    conectado: Boolean(r.conectado),
    conectadoEm: texto(r.conectado_em),
    liveMode: Boolean(r.live_mode)
  }
}
