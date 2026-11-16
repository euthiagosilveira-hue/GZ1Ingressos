import { exigirAdmin } from '../../../utils/admin-auth'
import {
  MAX_ITENS_IA,
  MAX_PRODUTOS_IA,
  type ProdutoParaIa,
  corpoPedidoCasamento,
  interpretarCasamento,
  promptCasarProdutos
} from '../../../utils/casar-produtos-ia'
import { chamarGemini, chaveGemini } from '../../../utils/gemini'

// "Dar baixa na reposicao": a IA liga os nomes da nota aos produtos
// cadastrados. So sugere; quem confirma e o administrador. Nada e salvo aqui.

export default defineEventHandler(async (event) => {
  const admin = await exigirAdmin(event)
  const chave = chaveGemini(event)

  const body = (await readBody(event).catch(() => ({}))) as { itens?: unknown }
  const itens = (Array.isArray(body?.itens) ? (body.itens as Record<string, unknown>[]) : [])
    .slice(0, MAX_ITENS_IA)
    .map((i) => ({
      nome: String(i?.nome ?? '').trim().slice(0, 160),
      quantidade: Number.isFinite(Number(i?.quantidade)) && Number(i?.quantidade) > 0 ? Number(i.quantidade) : null
    }))
  if (itens.length === 0 || itens.some((i) => !i.nome)) {
    throw createError({ statusCode: 400, statusMessage: 'DADOS_INVALIDOS' })
  }

  const { data, error } = await admin
    .from('reposicao_produtos')
    .select('id,nome,unidade,unidades_por_embalagem')
    .eq('ativo', true)
    .order('nome')
    .limit(MAX_PRODUTOS_IA)
  if (error) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  const produtos: ProdutoParaIa[] = (data ?? []).map((p) => ({
    id: String(p.id),
    nome: String(p.nome),
    unidade: String(p.unidade ?? 'unidade'),
    unidadesPorEmbalagem: Number(p.unidades_por_embalagem) > 0 ? Number(p.unidades_por_embalagem) : 1
  }))
  if (produtos.length === 0) return { itens: [] }

  const { texto, modelo } = await chamarGemini(
    event,
    chave,
    corpoPedidoCasamento(promptCasarProdutos(itens, produtos)),
    'casar-itens'
  )
  return { itens: interpretarCasamento(texto, itens.length, produtos), modelo }
})
