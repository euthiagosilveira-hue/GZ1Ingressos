/* GZ1 Ingressos - service worker de notificacoes push (vendas). */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let dados = {}
  try {
    dados = event.data ? event.data.json() : {}
  } catch {
    dados = { body: event.data ? event.data.text() : '' }
  }

  const titulo = dados.title || 'GZ1 Ingressos'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.body || '',
      tag: dados.tag,
      renotify: Boolean(dados.tag),
      data: { url: dados.url || '/' }
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destino = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && 'focus' in janela) {
          return janela.navigate(destino).then((j) => (j || janela).focus())
        }
      }
      return self.clients.openWindow(destino)
    })
  )
})
