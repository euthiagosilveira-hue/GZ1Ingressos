/** Converte a chave publica VAPID (base64url) para o formato do PushManager. */
export function chaveVapidParaBytes(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const binario = atob(base64)
  const bytes = new Uint8Array(binario.length)
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i)
  return bytes
}

export type EstadoPush = 'carregando' | 'indisponivel' | 'nao-configurado' | 'bloqueado' | 'desativado' | 'ativado'
