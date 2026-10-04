const CACHE = 'mela-shell-v1'
const scopeUrl = new URL(self.registration.scope)
const shellUrl = scopeUrl.pathname

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(shellUrl)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(shellUrl, copy)).catch(() => {})
      return response
    }).catch(() => caches.match(shellUrl).then((cached) => cached || Response.error())))
    return
  }

  if (url.pathname.includes('/assets/') || /\.(?:js|css|svg|png|jpg|jpeg|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) caches.open(CACHE).then((cache) => cache.put(request, response.clone())).catch(() => {})
      return response
    })))
  }
})
