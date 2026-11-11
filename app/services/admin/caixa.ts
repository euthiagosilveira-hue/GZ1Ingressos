import type {
  Agrupamento,
  CategoriaCaixa,
  ContaCaixa,
  FiltrosLancamentos,
  FluxoCaixa,
  LancamentoCaixa,
  LancamentoInput,
  ResumoLancamentos,
  TipoCategoria,
  TipoConta
} from '~/types/caixa'
import { comprimirComprovante } from '~/utils/comprimirImagem'
import {
  mapearCategoria,
  mapearConta,
  mapearFluxo,
  mapearLancamento,
  mapearResumoLancamentos
} from '~/utils/caixa'

// Caixa da galeria: RPCs seguras (somente ADMINISTRADOR).
// Os erros sobem como estao para a tela traduzir com mensagemErroCaixa().

type Bruto = Record<string, unknown>

export const BUCKET_COMPROVANTES = 'financeiro-comprovantes'

export async function listarContasCaixa(): Promise<ContaCaixa[]> {
  const { data, error } = await useSupabaseClient().rpc('listar_financeiro_contas_admin')
  if (error) throw error
  return ((data ?? []) as Bruto[]).map(mapearConta)
}

export async function salvarContaCaixa(input: {
  id: string | null
  nome: string
  tipo: TipoConta
  ativa: boolean
}): Promise<string> {
  const { data, error } = await useSupabaseClient().rpc('salvar_financeiro_conta_admin', {
    p_id: input.id,
    p_nome: input.nome.trim(),
    p_tipo: input.tipo,
    p_ativa: input.ativa
  })
  if (error) throw error
  return String((data as Bruto)?.id ?? '')
}

export async function definirSaldoInicialConta(contaId: string, valor: number): Promise<void> {
  const { error } = await useSupabaseClient().rpc('definir_saldo_inicial_conta_admin', {
    p_conta_id: contaId,
    p_valor: valor
  })
  if (error) throw error
}

export async function listarCategoriasCaixa(): Promise<CategoriaCaixa[]> {
  const { data, error } = await useSupabaseClient().rpc('listar_financeiro_categorias_admin')
  if (error) throw error
  return ((data ?? []) as Bruto[]).map(mapearCategoria)
}

export async function salvarCategoriaCaixa(input: {
  id: string | null
  nome: string
  tipo: TipoCategoria
  ativa: boolean
}): Promise<string> {
  const { data, error } = await useSupabaseClient().rpc('salvar_financeiro_categoria_admin', {
    p_id: input.id,
    p_nome: input.nome.trim(),
    p_tipo: input.tipo,
    p_ativa: input.ativa
  })
  if (error) throw error
  return String((data as Bruto)?.id ?? '')
}

export async function listarLancamentosCaixa(
  filtros: FiltrosLancamentos
): Promise<{ resumo: ResumoLancamentos; itens: LancamentoCaixa[] }> {
  const { data, error } = await useSupabaseClient().rpc('listar_financeiro_lancamentos_admin', {
    p_de: filtros.de,
    p_ate: filtros.ate,
    p_conta_id: filtros.contaId,
    p_categoria_id: filtros.categoriaId,
    p_evento_id: filtros.eventoId,
    p_tipo: filtros.tipo,
    p_busca: filtros.busca.trim() || null,
    p_incluir_cancelados: filtros.incluirCancelados
  })
  if (error) throw error
  const resposta = (data ?? {}) as Bruto
  return {
    resumo: mapearResumoLancamentos(resposta.resumo as Bruto),
    itens: (Array.isArray(resposta.itens) ? (resposta.itens as Bruto[]) : []).map(mapearLancamento)
  }
}

export async function salvarLancamentoCaixa(input: LancamentoInput): Promise<string> {
  const { data, error } = await useSupabaseClient().rpc('salvar_financeiro_lancamento_admin', {
    p_id: input.id,
    p_tipo: input.tipo,
    p_data: input.data,
    p_valor: input.valor,
    p_descricao: input.descricao.trim() || null,
    p_categoria_id: input.tipo === 'TRANSFERENCIA' ? null : input.categoriaId,
    p_conta_id: input.contaId,
    p_conta_destino_id: input.tipo === 'TRANSFERENCIA' ? input.contaDestinoId : null,
    p_evento_id: input.eventoId,
    p_comprovante_path: input.comprovantePath
  })
  if (error) throw error
  return String((data as Bruto)?.id ?? '')
}

export async function cancelarLancamentoCaixa(id: string, motivo: string): Promise<void> {
  const { error } = await useSupabaseClient().rpc('cancelar_financeiro_lancamento_admin', {
    p_id: id,
    p_motivo: motivo.trim()
  })
  if (error) throw error
}

export async function fecharBarCaixa(input: {
  data: string
  eventoId: string | null
  valores: { contaId: string; valor: number }[]
  observacao: string
}): Promise<{ total: number; lancamentos: number }> {
  const { data, error } = await useSupabaseClient().rpc('fechar_bar_financeiro_admin', {
    p_data: input.data,
    p_evento_id: input.eventoId,
    p_valores: input.valores.map((v) => ({ conta_id: v.contaId, valor: v.valor })),
    p_observacao: input.observacao.trim() || null
  })
  if (error) throw error
  const r = (data ?? {}) as Bruto
  return { total: Number(r.total ?? 0), lancamentos: Number(r.lancamentos ?? 0) }
}

export async function obterFluxoCaixa(input: {
  de: string
  ate: string
  agrupamento: Agrupamento
  eventoId: string | null
  contaId: string | null
}): Promise<FluxoCaixa> {
  const { data, error } = await useSupabaseClient().rpc('obter_fluxo_caixa_admin', {
    p_de: input.de,
    p_ate: input.ate,
    p_agrupamento: input.agrupamento,
    p_evento_id: input.eventoId,
    p_conta_id: input.contaId
  })
  if (error) throw error
  return mapearFluxo(data as Bruto)
}

/** Envia a foto/PDF do comprovante e devolve o caminho no bucket privado. */
export async function enviarComprovante(original: File): Promise<string> {
  // Fotos grandes sao reduzidas antes de subir (sem perder a leitura).
  const arquivo = await comprimirComprovante(original)
  if (arquivo.size > 10 * 1024 * 1024) throw new Error('Arquivo maior que 10 MB')
  const extensao = (arquivo.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const agora = new Date()
  const caminho = `${agora.getFullYear()}/${String(agora.getMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${extensao}`
  const { error } = await useSupabaseClient()
    .storage.from(BUCKET_COMPROVANTES)
    .upload(caminho, arquivo, { contentType: arquivo.type || undefined, upsert: false })
  if (error) throw error
  return caminho
}

/** Link temporario (10 min) para abrir um comprovante. */
export async function linkComprovante(caminho: string): Promise<string> {
  const { data, error } = await useSupabaseClient()
    .storage.from(BUCKET_COMPROVANTES)
    .createSignedUrl(caminho, 600)
  if (error || !data?.signedUrl) throw error ?? new Error('Sem link')
  return data.signedUrl
}

export type LeituraComprovanteIa = {
  valor: number | null
  data: string | null
  descricao: string | null
  categoriaId: string | null
}

/** Pede para a IA (Gemini) ler o comprovante ja enviado e sugerir os campos. */
export async function lerComprovanteComIa(
  caminho: string,
  tipo: 'ENTRADA' | 'SAIDA'
): Promise<LeituraComprovanteIa> {
  return await $fetch<LeituraComprovanteIa>('/api/admin/financeiro/ler-comprovante', {
    method: 'POST',
    body: { caminho, tipo }
  })
}
