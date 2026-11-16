/**
 * Abre em outra aba um link que so fica pronto depois de um `await`
 * (ex.: link temporario do comprovante).
 *
 * No celular (Safari/Chrome) o navegador bloqueia `window.open` chamado
 * depois de um `await`, porque ja nao conta como "clique do usuario".
 * Por isso a aba e aberta na hora do clique e so depois recebe o endereco.
 * Se o navegador nao deixar abrir a aba, abre na propria pagina.
 */
export async function abrirLinkEmNovaAba(obterLink: () => Promise<string>): Promise<void> {
  const janela = typeof window !== 'undefined' ? window.open('', '_blank') : null
  try {
    const link = await obterLink()
    if (janela && !janela.closed) {
      janela.opener = null
      janela.location.href = link
    } else {
      window.location.href = link
    }
  } catch (e) {
    janela?.close()
    throw e
  }
}
