import { exigirAdmin } from '../../../../utils/admin-auth'
import {
  gerarTxtPagantes,
  gerarXlsxPagantes,
  montarLinhasPagantes,
  nomeArquivoPagantes,
  type PaganteOrigem
} from '../../../../utils/lista-pagantes'

const POR_PAGINA = 1000

/**
 * Baixa a lista de pagantes de um evento (?formato=xlsx | txt).
 * So ADMINISTRADOR. Inclui ingressos validos e ja utilizados de pedidos pagos,
 * em ordem alfabetica, para conferencia manual se o sistema ficar fora do ar.
 */
export default defineEventHandler(async (event) => {
  const eventoId = String(getRouterParam(event, 'id') ?? '').trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventoId)) {
    throw createError({ statusCode: 400, statusMessage: 'DADOS_INVALIDOS' })
  }
  const formato = String(getQuery(event).formato ?? 'xlsx')
  if (formato !== 'xlsx' && formato !== 'txt') {
    throw createError({ statusCode: 400, statusMessage: 'FORMATO_INVALIDO' })
  }

  const admin = await exigirAdmin(event)

  const { data: evento, error: erroEvento } = await admin
    .from('eventos')
    .select('nome,inicio_em')
    .eq('id', eventoId)
    .maybeSingle()
  if (erroEvento) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
  if (!evento) throw createError({ statusCode: 404, statusMessage: 'NAO_ENCONTRADO' })

  const itens: PaganteOrigem[] = []
  for (let inicio = 0; ; inicio += POR_PAGINA) {
    const { data, error } = await admin
      .from('ingressos')
      .select(
        'codigo,participante_nome,status,utilizado_em,pedidos(codigo,comprador_nome,comprador_telefone,status),lotes(nome)'
      )
      .eq('evento_id', eventoId)
      .in('status', ['VALIDO', 'UTILIZADO'])
      .order('codigo')
      .range(inicio, inicio + POR_PAGINA - 1)
    if (error) throw createError({ statusCode: 500, statusMessage: 'ERRO_INESPERADO' })
    itens.push(...((data ?? []) as unknown as PaganteOrigem[]))
    if (!data || data.length < POR_PAGINA) break
  }

  const linhas = montarLinhasPagantes(itens)
  const cabecalho = { eventoNome: evento.nome, eventoInicio: evento.inicio_em, geradaEm: new Date() }
  const nome = nomeArquivoPagantes(evento.nome)

  setResponseHeader(event, 'Cache-Control', 'no-store')
  if (formato === 'txt') {
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    setResponseHeader(event, 'Content-Disposition', `attachment; filename="${nome}.txt"`)
    return gerarTxtPagantes(cabecalho, linhas)
  }

  setResponseHeader(
    event,
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )
  setResponseHeader(event, 'Content-Disposition', `attachment; filename="${nome}.xlsx"`)
  return Buffer.from(gerarXlsxPagantes(cabecalho, linhas))
})
