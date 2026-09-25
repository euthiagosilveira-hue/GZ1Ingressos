import type { LotListItem } from '~/types/lote'

export const lotesMock: Record<string, LotListItem[]> = {
  evt_001: [
    {
      id: 'lote_001',
      eventoId: 'evt_001',
      nome: 'Lote 1',
      ordem: 1,
      quantidade: 150,
      preco: 40,
      tipoAtivacao: 'MANUAL',
      ativacaoEm: null,
      ativadoEm: '2026-08-20T10:00:00-03:00',
      encerradoEm: null,
      status: 'ATIVO',
      vendidos: 132,
      disponiveis: 18
    },
    {
      id: 'lote_002',
      eventoId: 'evt_001',
      nome: 'Lote 2',
      ordem: 2,
      quantidade: 200,
      preco: 50,
      tipoAtivacao: 'ESGOTAMENTO',
      ativacaoEm: null,
      ativadoEm: null,
      encerradoEm: null,
      status: 'INATIVO',
      vendidos: 0,
      disponiveis: 200
    },
    {
      id: 'lote_003',
      eventoId: 'evt_001',
      nome: 'Lote 3',
      ordem: 3,
      quantidade: 200,
      preco: 60,
      tipoAtivacao: 'DATA_HORA',
      ativacaoEm: '2026-09-01T10:00:00-03:00',
      ativadoEm: null,
      encerradoEm: null,
      status: 'INATIVO',
      vendidos: 0,
      disponiveis: 200
    }
  ],
  evt_002: [
    {
      id: 'lote_004',
      eventoId: 'evt_002',
      nome: 'Lote 1',
      ordem: 1,
      quantidade: 100,
      preco: 60,
      tipoAtivacao: 'MANUAL',
      ativacaoEm: null,
      ativadoEm: '2026-08-01T09:00:00-03:00',
      encerradoEm: '2026-08-31T23:59:00-03:00',
      status: 'ENCERRADO',
      vendidos: 100,
      disponiveis: 0
    },
    {
      id: 'lote_005',
      eventoId: 'evt_002',
      nome: 'Lote 2',
      ordem: 2,
      quantidade: 150,
      preco: 80,
      tipoAtivacao: 'MANUAL',
      ativacaoEm: null,
      ativadoEm: '2026-09-01T00:00:00-03:00',
      encerradoEm: null,
      status: 'ATIVO',
      vendidos: 54,
      disponiveis: 96
    },
    {
      id: 'lote_006',
      eventoId: 'evt_002',
      nome: 'Lote 3',
      ordem: 3,
      quantidade: 180,
      preco: 90,
      tipoAtivacao: 'ESGOTAMENTO',
      ativacaoEm: null,
      ativadoEm: null,
      encerradoEm: null,
      status: 'INATIVO',
      vendidos: 0,
      disponiveis: 180
    }
  ],
  evt_004: []
}

export const estoqueAntecipadoMock: Record<string, number> = {
  evt_001: 100,
  evt_002: 60,
  evt_004: 80
}

export function buscarLotesMock(eventoId: string): LotListItem[] {
  return (lotesMock[eventoId] ?? []).map((lote) => ({ ...lote }))
}

export function buscarEstoqueAntecipado(eventoId: string): number {
  return estoqueAntecipadoMock[eventoId] ?? 0
}
