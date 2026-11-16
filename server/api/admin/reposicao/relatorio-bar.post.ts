import { exigirAdmin } from '../../../utils/admin-auth'
import { linkRelatorioValido, lerRelatorioBar } from '../../../utils/relatorio-bar'

// Le o relatorio "Resumo de vendas" do sistema do bar, pelo link (Compufour)
// ou pelo HTML do arquivo enviado. Nada e salvo aqui: a tela mostra a
// previa e a pessoa confirma.

const LIMITE = 6 * 1024 * 1024

async function baixar(url: URL): Promise<string> {
  let resposta: Response
  try {
    resposta = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(20_000) })
  } catch {
    throw createError({ statusCode: 502, statusMessage: 'LINK_INACESSIVEL' })
  }
  if (resposta.status === 403 || resposta.status === 404) {
    throw createError({ statusCode: 404, statusMessage: 'LINK_EXPIRADO' })
  }
  if (!resposta.ok) throw createError({ statusCode: 502, statusMessage: 'LINK_INACESSIVEL' })
  const tamanho = Number(resposta.headers.get('content-length') ?? 0)
  if (tamanho > LIMITE) throw createError({ statusCode: 413, statusMessage: 'ARQUIVO_GRANDE' })
  const texto = await resposta.text()
  if (texto.length > LIMITE) throw createError({ statusCode: 413, statusMessage: 'ARQUIVO_GRANDE' })
  return texto
}

export default defineEventHandler(async (event) => {
  await exigirAdmin(event)

  const body = (await readBody(event).catch(() => ({}))) as { url?: unknown; html?: unknown }
  let html: string
  let origem: string | null = null
  if (typeof body?.html === 'string' && body.html.trim()) {
    if (body.html.length > LIMITE) throw createError({ statusCode: 413, statusMessage: 'ARQUIVO_GRANDE' })
    html = body.html
  } else {
    const url = linkRelatorioValido(String(body?.url ?? ''))
    if (!url) throw createError({ statusCode: 400, statusMessage: 'LINK_INVALIDO' })
    html = await baixar(url)
    origem = url.toString()
  }

  const relatorio = lerRelatorioBar(html)
  if (!relatorio) throw createError({ statusCode: 422, statusMessage: 'NAO_LEU' })
  return { ...relatorio, origem }
})
