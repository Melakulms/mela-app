const CACHE = 'mela-shell-v12-public-offline'
const scopeUrl = new URL(self.registration.scope)
const shellUrl = scopeUrl.pathname
const offlineUrl = `${shellUrl}offline.html`
const handbookUrl = `${shellUrl}ai-year-one.html`
const publicPages = [offlineUrl, handbookUrl]
const publicFiles = [`${shellUrl}offline-progress.js`]

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([...publicPages, ...publicFiles])).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mela-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || !url.pathname.startsWith(scopeUrl.pathname) || request.headers?.has('Authorization')) return
  if (request.mode === 'navigate') {
    // Never store navigation URLs: they may contain confirmation/recovery tokens.
    // Only these static public files are allowed into the offline library.
    const publicPage = publicPages.includes(url.pathname) && !url.search
    const appHome = url.pathname === shellUrl || url.pathname === `${shellUrl}index.html`
    event.respondWith(fetch(request).then(response => {
      if (publicPage && response.ok && response.headers.get('content-type')?.includes('text/html')) {
        const copy = response.clone()
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(url.pathname, copy)).catch(() => {}))
      }
      return response
    }).catch(async () => {
      const cache = await caches.open(CACHE)
      const cached = await cache.match(publicPage ? url.pathname : offlineUrl)
      return (publicPage || appHome) && cached ? cached : Response.error()
    }))
    return
  }
  // APIs, private documents, arbitrary paths and signed query URLs are excluded.
  if (!url.search && (publicFiles.includes(url.pathname) || url.pathname.startsWith(`${shellUrl}assets/`) || /^mela-icon[^/]*\.(png|svg)$/.test(url.pathname.slice(shellUrl.length)))) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(request)).then(cached => cached || fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone()
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}))
      }
      return response
    })))
  }
})
