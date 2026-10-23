export interface ShareData {
  title: string
  text: string
  url: string
}

export type ShareResult = 'compartilhado' | 'copiado' | 'falha'

export function montarShareData(input: { url: string; eventoNome: string }): ShareData {
  return {
    title: 'GZ1 Ingresso',
    text: `Seu ingresso para ${input.eventoNome}`,
    url: input.url
  }
}

/**
 * Compartilha via Web Share API quando disponivel; caso contrario copia o link.
 * Nunca compartilha QR/token diretamente (apenas a URL publica).
 */
export async function compartilharOuCopiar(input: {
  url: string
  eventoNome: string
}): Promise<ShareResult> {
  const data = montarShareData(input)

  const nav = typeof navigator !== 'undefined' ? navigator : undefined

  if (nav && typeof nav.share === 'function') {
    try {
      await nav.share(data)
      return 'compartilhado'
    } catch (e) {
      // Usuario cancelou: nao tratar como erro.
      if ((e as DOMException)?.name === 'AbortError') return 'compartilhado'
    }
  }

  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(input.url)
      return 'copiado'
    }
  } catch {
    // cai no fallback abaixo
  }

  return 'falha'
}

/**
 * Link do WhatsApp com a mensagem do ingresso ja escrita.
 * Telefone brasileiro (DDD + numero) recebe o 55 na frente; sem telefone,
 * o WhatsApp abre para o usuario escolher o contato.
 */
export function montarLinkWhatsApp(input: {
  url: string
  eventoNome: string
  participanteNome?: string | null
  telefone?: string | null
}): string {
  const saudacao = input.participanteNome ? `Olá, ${input.participanteNome}! ` : ''
  const evento = input.eventoNome ? ` para ${input.eventoNome}` : ''
  const texto = `${saudacao}Aqui está seu ingresso${evento}. Apresente o QR Code na entrada: ${input.url}`

  let digitos = (input.telefone ?? '').replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`
  if (digitos.length < 12 || digitos.length > 13) digitos = ''

  const base = digitos ? `https://wa.me/${digitos}` : 'https://wa.me/'
  return `${base}?text=${encodeURIComponent(texto)}`
}
