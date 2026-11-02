import type { SociedadeTotais } from '~/types/sociedade'

export interface EventoProdutorItem {
  eventoId: string
  nome: string
  slug: string
  imagemUrl: string | null
  inicioEm: string
  local: string | null
  status: string
  vendasStatus: string | null
  publicacaoStatus: string | null
  percentualGaleria: number
  percentualProdutor: number
  vendidos: number
}

export interface EventoProdutorDetalhe extends EventoProdutorItem {
  capacidadeTotal: number | null
  produtorNome: string
  utilizados: number
  vipTotal: number
  vipEntraram: number
  loteAtivo: { nome: string; preco: number } | null
  totais: SociedadeTotais
}

export interface VendaProdutor {
  codigo: string
  compradorNome: string
  quantidade: number
  valorTotal: number
  forma: 'ONLINE' | 'PORTARIA'
  pagoEm: string | null
}

export interface VipProdutor {
  vipId: string
  nome: string
  observacao: string | null
  entrou: boolean
  entradaEm: string | null
  adicionadoPorMim: boolean
}
