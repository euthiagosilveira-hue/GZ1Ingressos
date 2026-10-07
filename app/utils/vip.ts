import type {
  AdminVipRow,
  VipConvidado,
  VipFormValue,
  VipPayload,
  VipResumo,
  VipStatus
} from '~/types/vip'

function normalizar(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Status derivado: nao ha estado duplicado no banco. */
export function statusVip(vip: Pick<VipConvidado, 'entrou'>): VipStatus {
  return vip.entrou ? 'ENTROU' : 'AGUARDANDO'
}

export function rotuloStatusVip(status: VipStatus): string {
  return status === 'ENTROU' ? 'Entrou' : 'Aguardando'
}

/** Converte a linha bruta da RPC no view-model. */
export function mapearVipAdmin(row: AdminVipRow): VipConvidado {
  return {
    vipId: row.vip_id,
    nome: row.nome,
    telefone: row.telefone,
    observacao: row.observacao,
    entrou: Boolean(row.entrou),
    entradaEm: row.entrada_em,
    criadoEm: row.criado_em,
    criadoPor: row.criado_por
  }
}

export function validarVip(form: VipFormValue): { nome?: string } {
  const erros: { nome?: string } = {}
  if (!form.nome.trim()) erros.nome = 'Informe o nome do convidado.'
  return erros
}

/** Normaliza telefone/observacao vazios para null. */
export function montarPayloadVip(form: VipFormValue): VipPayload {
  const telefone = form.telefone.trim()
  const observacao = form.observacao.trim()
  return {
    nome: form.nome.trim(),
    telefone: telefone ? telefone : null,
    observacao: observacao ? observacao : null
  }
}

export function filtrarVips(vips: VipConvidado[], busca: string): VipConvidado[] {
  const termo = normalizar(busca)
  if (!termo) return vips
  return vips.filter(
    (vip) => normalizar(vip.nome).includes(termo) || normalizar(vip.telefone ?? '').includes(termo)
  )
}

export function resumoVips(vips: VipConvidado[]): VipResumo {
  return vips.reduce<VipResumo>(
    (acumulado, vip) => {
      acumulado.total += 1
      if (vip.entrou) acumulado.entraram += 1
      else acumulado.aguardando += 1
      return acumulado
    },
    { total: 0, aguardando: 0, entraram: 0 }
  )
}

interface RpcErrorLike {
  code?: string | null
  message?: string | null
}

/** Traduz erros das RPCs de Lista VIP para mensagens ao operador. */
export function mensagemErroVip(error: RpcErrorLike | null): string {
  const e = error ?? {}
  const mensagem = (e.message ?? '').toLowerCase()

  if (e.code === '42501' || mensagem.includes('permiss')) {
    return 'Você não tem permissão para gerenciar a lista VIP.'
  }
  if (mensagem.includes('ja registrou entrada')) {
    return 'O convidado já registrou entrada e não pode ser alterado.'
  }
  if (mensagem.includes('nao permite alterar a lista vip')) {
    return 'Este evento não permite alterar a lista VIP.'
  }
  if (mensagem.includes('informe o nome')) {
    return 'Informe o nome do convidado.'
  }
  if (mensagem.includes('nao encontrado')) {
    return 'Evento ou convidado não encontrado.'
  }
  if (e.code === '23514') {
    return 'Verifique os dados informados.'
  }
  return 'Não foi possível concluir a operação.'
}
