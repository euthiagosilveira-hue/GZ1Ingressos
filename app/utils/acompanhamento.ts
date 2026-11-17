import type {
  Acompanhante,
  EventoAcompanhamentoDetalhe,
  EventoAcompanhamentoItem,
  ResumoVendasEvento,
  VendaAcompanhamento
} from '../types/acompanhamento'

type Row = Record<string, unknown>

function numero(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function numeroOuNulo(v: unknown): number | null {
  return v == null ? null : numero(v)
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

function lista(v: unknown): Row[] {
  return Array.isArray(v) ? (v as Row[]) : []
}

export function mapearEventoAcompanhamento(r: Row): EventoAcompanhamentoItem {
  return {
    eventoId: String(r.evento_id),
    nome: String(r.nome ?? ''),
    slug: String(r.slug ?? ''),
    imagemUrl: texto(r.imagem_url),
    inicioEm: String(r.inicio_em ?? ''),
    local: texto(r.local),
    status: String(r.status ?? ''),
    ingressos: numero(r.ingressos),
    valorTotal: numero(r.valor_total)
  }
}

export function mapearResumoVendas(r: Row | null | undefined): ResumoVendasEvento {
  const x = r ?? {}
  return {
    pedidosPagos: numero(x.pedidos_pagos),
    ingressos: numero(x.ingressos),
    valorTotal: numero(x.valor_total),
    valorOnline: numero(x.valor_online),
    valorPortaria: numero(x.valor_portaria),
    porLote: lista(x.por_lote).map((l) => ({
      loteId: texto(l.lote_id),
      nome: String(l.nome ?? ''),
      preco: numeroOuNulo(l.preco),
      disponibilizados: numeroOuNulo(l.disponibilizados),
      status: texto(l.status),
      ingressos: numero(l.ingressos),
      valor: numero(l.valor)
    })),
    porDia: lista(x.por_dia).map((d) => ({
      dia: String(d.dia ?? ''),
      ingressos: numero(d.ingressos),
      valor: numero(d.valor)
    }))
  }
}

export function mapearEventoAcompanhamentoDetalhe(r: Row): EventoAcompanhamentoDetalhe {
  const lote = (r.lote_ativo ?? null) as Row | null
  return {
    eventoId: String(r.evento_id),
    nome: String(r.nome ?? ''),
    slug: String(r.slug ?? ''),
    imagemUrl: texto(r.imagem_url),
    inicioEm: String(r.inicio_em ?? ''),
    local: texto(r.local),
    status: String(r.status ?? ''),
    capacidadeTotal: numeroOuNulo(r.capacidade_total),
    utilizados: numero(r.utilizados),
    loteAtivo: lote ? { nome: String(lote.nome ?? ''), preco: numero(lote.preco) } : null,
    resumo: mapearResumoVendas(r.resumo as Row | null)
  }
}

export function mapearVendaAcompanhamento(r: Row): VendaAcompanhamento {
  return {
    codigo: String(r.codigo ?? ''),
    compradorNome: String(r.comprador_nome ?? ''),
    quantidade: numero(r.quantidade),
    valorTotal: numero(r.valor_total),
    loteNome: texto(r.lote_nome),
    forma: r.forma === 'PORTARIA' ? 'PORTARIA' : 'ONLINE',
    pagoEm: texto(r.pago_em)
  }
}

export function mapearAcompanhante(r: Row): Acompanhante {
  return {
    usuarioId: String(r.usuario_id),
    nome: String(r.nome ?? ''),
    email: String(r.email ?? ''),
    ativo: Boolean(r.ativo),
    ultimoAcessoEm: texto(r.ultimo_acesso_em),
    adicionadoEm: texto(r.adicionado_em),
    eventosCount: r.eventos_count == null ? undefined : numero(r.eventos_count)
  }
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

/** "2026-11-17" -> "ter, 17/11" (a data ja vem no horario de Brasilia). */
export function formatarDiaVenda(dia: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia ?? '')
  if (!m) return dia ?? ''
  const semana = DIAS_SEMANA[new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay()]
  return `${semana}, ${m[3]}/${m[2]}`
}

/** Busca simples por nome do comprador (sem acento, sem maiusculas). */
export function filtrarVendasPorNome(vendas: VendaAcompanhamento[], busca: string): VendaAcompanhamento[] {
  const normalizar = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const termo = normalizar(busca ?? '')
  if (!termo) return vendas
  return vendas.filter((v) => normalizar(v.compradorNome).includes(termo) || v.codigo.toLowerCase().includes(termo))
}

/** Mensagem amigavel para os erros das RPCs de acompanhamento. */
export function mensagemErroAcompanhamento(
  error: { code?: string; message?: string } | null,
  padrao: string
): string {
  const mensagem = (error?.message ?? '').toLowerCase()
  if (error?.code === '42501' || mensagem.includes('permiss')) {
    return 'Seu acesso de acompanhamento não está ativo. Fale com a galeria.'
  }
  if (mensagem.includes('evento nao encontrado')) return 'Evento não encontrado.'
  if (mensagem.includes('acompanhante nao encontrado')) return 'Essa pessoa já não tinha acesso a este evento.'
  return padrao
}
