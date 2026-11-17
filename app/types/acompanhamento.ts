export interface EventoAcompanhamentoItem {
  eventoId: string
  nome: string
  slug: string
  imagemUrl: string | null
  inicioEm: string
  local: string | null
  status: string
  ingressos: number
  valorTotal: number
}

export interface VendaPorLote {
  loteId: string | null
  nome: string
  preco: number | null
  disponibilizados: number | null
  status: string | null
  ingressos: number
  valor: number
}

export interface VendaPorDia {
  /** AAAA-MM-DD (horario de Brasilia) */
  dia: string
  ingressos: number
  valor: number
}

export interface ResumoVendasEvento {
  pedidosPagos: number
  ingressos: number
  valorTotal: number
  valorOnline: number
  valorPortaria: number
  porLote: VendaPorLote[]
  porDia: VendaPorDia[]
}

export interface EventoAcompanhamentoDetalhe {
  eventoId: string
  nome: string
  slug: string
  imagemUrl: string | null
  inicioEm: string
  local: string | null
  status: string
  capacidadeTotal: number | null
  utilizados: number
  loteAtivo: { nome: string; preco: number } | null
  resumo: ResumoVendasEvento
}

export interface VendaAcompanhamento {
  codigo: string
  compradorNome: string
  quantidade: number
  valorTotal: number
  loteNome: string | null
  forma: 'ONLINE' | 'PORTARIA'
  pagoEm: string | null
}

export interface Acompanhante {
  usuarioId: string
  nome: string
  email: string
  ativo: boolean
  ultimoAcessoEm: string | null
  adicionadoEm: string | null
  eventosCount?: number
}
