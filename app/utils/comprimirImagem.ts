/**
 * Compressao de fotos de comprovante antes do envio.
 *
 * Mantem a leitura do comprovante: lado maior de no maximo 2000 px e JPEG
 * qualidade 0,85. Fotos pequenas, PDFs e formatos que o navegador nao consegue
 * abrir sobem como estao. Se a versao comprimida nao ficar menor, ou der erro,
 * envia a original.
 */

export const LADO_MAXIMO_COMPROVANTE = 2000
export const QUALIDADE_COMPROVANTE = 0.85
/** Ate este tamanho a foto sobe sem mexer. */
export const LIMITE_SEM_COMPRESSAO = 1024 * 1024

const TIPOS_COMPRIMIVEIS = ['image/jpeg', 'image/png', 'image/webp']

export function podeComprimir(tipo: string, tamanho: number): boolean {
  return TIPOS_COMPRIMIVEIS.includes(tipo) && tamanho > LIMITE_SEM_COMPRESSAO
}

/** Novas dimensoes mantendo a proporcao; nunca aumenta a imagem. */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  ladoMaximo = LADO_MAXIMO_COMPROVANTE
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)
  if (maior <= ladoMaximo || maior <= 0) return { largura, altura }
  const escala = ladoMaximo / maior
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala))
  }
}

export function nomeJpg(nome: string): string {
  const base = nome.replace(/\.[^./\\]+$/, '') || 'comprovante'
  return `${base}.jpg`
}

/** Comprime a foto no navegador. Em qualquer problema devolve o arquivo original. */
export async function comprimirComprovante(arquivo: File): Promise<File> {
  if (!podeComprimir(arquivo.type, arquivo.size)) return arquivo
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return arquivo

  try {
    // 'from-image' respeita a rotacao da foto do celular (EXIF).
    const bitmap = await createImageBitmap(arquivo, { imageOrientation: 'from-image' })
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return arquivo
    }
    // Fundo branco: PNG transparente vira JPEG sem fundo preto.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, largura, altura)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, largura, altura)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALIDADE_COMPROVANTE)
    )
    if (!blob || blob.size >= arquivo.size) return arquivo
    return new File([blob], nomeJpg(arquivo.name), { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    return arquivo
  }
}
