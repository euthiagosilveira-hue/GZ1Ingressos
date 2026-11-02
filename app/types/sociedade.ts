export interface Produtor {
  produtorId: string
  nome: string
  documento: string | null
  telefone: string | null
  email: string | null
  ativo: boolean
  temLogin: boolean
  eventosCount?: number
}

export interface ProdutorInput {
  produtorId?: string | null
  nome: string
  documento?: string | null
  telefone?: string | null
  email?: string | null
}

export interface SociedadeTotais {
  pedidosPagos: number
  online: number
  portaria: number
  total: number
  galeria: number
  produtor: number
  galeriaOnline: number
  produtorOnline: number
  galeriaPortaria: number
  produtorPortaria: number
}

export interface SociedadeEvento {
  eventoId: string
  ativa: boolean
  produtor: Produtor | null
  percentualGaleria: number
  percentualProdutor: number
  totais: SociedadeTotais | null
}
