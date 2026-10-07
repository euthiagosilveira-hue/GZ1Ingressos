/** Resultados possiveis de public.registrar_entrada_qr (enum real do backend). */
export type GateRpcResultado =
  | 'LIBERADO'
  | 'JA_UTILIZADO'
  | 'NAO_ENCONTRADO'
  | 'EVENTO_INCORRETO'
  | 'CANCELADO'
  | 'INVALIDO'

/** Resposta normalizada da RPC de portaria. */
export interface RegistrarEntradaQrResult {
  resultado: GateRpcResultado
  ingressoId: string | null
  vipId: string | null
  codigo: string | null
  participanteNome: string | null
  entradaId: string | null
  entradaEm: string | null
  mensagem: string
}

/** Erros de transporte/permissao do scanner (nao sao resultados de negocio). */
export type GateScanErroCode = 'SEM_EVENTO' | 'SEM_PERMISSAO' | 'QR_INVALIDO' | 'ERRO_TEMPORARIO'

/** Estado local da camera. */
export type GateCameraStatus =
  | 'IDLE'
  | 'SOLICITANDO'
  | 'ATIVA'
  | 'NEGADA'
  | 'INDISPONIVEL'
  | 'SEM_SUPORTE'
  | 'ERRO'

/** Evento operacional listado para a portaria (public.listar_eventos_portaria). */
export interface EventoPortaria {
  eventoId: string
  nome: string
  inicioEm: string
  local: string
  status: string
}

/** Origem de um item no resultado da busca por nome da portaria. */
export type OrigemBuscaPortaria = 'INGRESSO' | 'VIP'

/** Resultado de public.buscar_ingressos_por_nome (ingressos + Lista VIP). */
export interface IngressoBuscaNome {
  origem: OrigemBuscaPortaria
  ingressoId: string | null
  vipId: string | null
  codigo: string | null
  participanteNome: string
  status: string
  utilizadoEm: string | null
  entradaEm: string | null
}
