import { ref } from 'vue'

import { chaveVapidParaBytes, type EstadoPush } from '~/utils/push'

const SW_URL = '/sw.js'

/** Liga/desliga as notificacoes push de venda neste aparelho. */
export function usePushVendas() {
  const config = useRuntimeConfig()
  const estado = ref<EstadoPush>('carregando')
  const processando = ref(false)

  function suportado(): boolean {
    return (
      import.meta.client &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  async function inscricaoAtual(): Promise<PushSubscription | null> {
    const registro = await navigator.serviceWorker.getRegistration('/')
    return (await registro?.pushManager.getSubscription()) ?? null
  }

  async function salvarNoServidor(inscricao: PushSubscription) {
    await $fetch('/api/push/inscricao', { method: 'POST', body: inscricao.toJSON() })
  }

  async function verificar() {
    if (!suportado()) {
      estado.value = 'indisponivel'
      return
    }
    if (!config.public.vapidPublicKey) {
      estado.value = 'nao-configurado'
      return
    }
    if (Notification.permission === 'denied') {
      estado.value = 'bloqueado'
      return
    }
    const inscricao = await inscricaoAtual().catch(() => null)
    if (inscricao && Notification.permission === 'granted') {
      estado.value = 'ativado'
      // Mantem o servidor sincronizado caso o navegador tenha renovado a inscricao.
      salvarNoServidor(inscricao).catch(() => {})
    } else {
      estado.value = 'desativado'
    }
  }

  async function ativar(): Promise<boolean> {
    if (!suportado() || !config.public.vapidPublicKey) return false
    processando.value = true
    try {
      const permissao = await Notification.requestPermission()
      if (permissao !== 'granted') {
        estado.value = permissao === 'denied' ? 'bloqueado' : 'desativado'
        return false
      }
      await navigator.serviceWorker.register(SW_URL, { scope: '/' })
      const registro = await navigator.serviceWorker.ready
      const inscricao =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: chaveVapidParaBytes(String(config.public.vapidPublicKey))
        }))
      await salvarNoServidor(inscricao)
      estado.value = 'ativado'
      return true
    } finally {
      processando.value = false
    }
  }

  async function desativar() {
    processando.value = true
    try {
      const inscricao = await inscricaoAtual()
      if (inscricao) {
        await $fetch('/api/push/inscricao', { method: 'DELETE', body: { endpoint: inscricao.endpoint } }).catch(
          () => {}
        )
        await inscricao.unsubscribe()
      }
      estado.value = 'desativado'
    } finally {
      processando.value = false
    }
  }

  async function testar(): Promise<number> {
    const resposta = await $fetch<{ enviadas: number }>('/api/push/teste', { method: 'POST' })
    return resposta.enviadas
  }

  return { estado, processando, verificar, ativar, desativar, testar }
}
