import type { GateRpcResultado, RegistrarEntradaQrResult } from '~/types/gate'

/**
 * Validacao apenas de FORMATO (nao decide negocio).
 * O conteudo esperado e um token opaco (UUID). Nada de URL/JSON.
 */
export function qrTokenPlausivel(valor: string): boolean {
  const v = (valor ?? '').trim()
  if (v.length < 8 || v.length > 512) return false
  if (/\s/.test(v)) return false
  return true
}

export function uuidValido(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor)
}

/** Mascara o token para exibicao/log (nunca expor cru). */
export function mascararToken(valor: string): string {
  if (!valor) return ''
  if (valor.length <= 8) return '****'
  return `${valor.slice(0, 4)}****${valor.slice(-2)}`
}

/** Trava de leitura: evita processar o mesmo QR varias vezes. */
export class LeituraLock {
  private bloqueado = false

  podeProcessar(): boolean {
    return !this.bloqueado
  }

  bloquear(): void {
    this.bloqueado = true
  }

  liberar(): void {
    this.bloqueado = false
  }
}

/** Normaliza o jsonb da RPC para tipo forte. */
export function mapearResultadoEntradaRpc(raw: Record<string, unknown>): RegistrarEntradaQrResult {
  return {
    resultado: (raw?.resultado as GateRpcResultado) ?? 'INVALIDO',
    ingressoId: (raw?.ingresso_id as string) ?? null,
    codigo: (raw?.codigo as string) ?? null,
    participanteNome: (raw?.participante_nome as string) ?? null,
    entradaId: (raw?.entrada_id as string) ?? null,
    entradaEm: (raw?.entrada_em as string) ?? null,
    mensagem: (raw?.mensagem as string) ?? ''
  }
}

export interface ResultadoEntradaRotulo {
  titulo: string
  descricao: string
  sucesso: boolean
}

export function rotuloResultadoEntrada(resultado: GateRpcResultado): ResultadoEntradaRotulo {
  const mapa: Record<GateRpcResultado, ResultadoEntradaRotulo> = {
    LIBERADO: {
      titulo: 'Entrada liberada',
      descricao: 'Entrada registrada com sucesso.',
      sucesso: true
    },
    JA_UTILIZADO: {
      titulo: 'Ingresso já utilizado',
      descricao: 'Este ingresso já registrou entrada.',
      sucesso: false
    },
    NAO_ENCONTRADO: {
      titulo: 'Ingresso não encontrado',
      descricao: 'Nenhum ingresso corresponde a este QR Code.',
      sucesso: false
    },
    EVENTO_INCORRETO: {
      titulo: 'Evento incorreto',
      descricao: 'Este ingresso pertence a outro evento.',
      sucesso: false
    },
    CANCELADO: {
      titulo: 'Ingresso cancelado',
      descricao: 'Este ingresso foi cancelado e não pode ser utilizado.',
      sucesso: false
    },
    INVALIDO: {
      titulo: 'Ingresso inválido',
      descricao: 'Este ingresso não pode ser utilizado.',
      sucesso: false
    }
  }
  return mapa[resultado]
}
