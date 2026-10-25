// @vitest-environment node
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker() {
  const listeners: Record<string, (event: any) => void> = {}
  const cache = { put: vi.fn(), match: vi.fn(), add: vi.fn(), addAll: vi.fn(async () => {}) }
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ['mela-shell-v0', 'mela-shell-v1', 'mela-shell-v3-ai-review', 'other-app-cache']), delete: vi.fn() }
  const fetch = vi.fn()
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL, Response, caches, fetch,
    self: { registration: { scope: 'https://example.test/mela-app/' }, location: { origin: 'https://example.test' },
      addEventListener: (name: string, callback: any) => { listeners[name] = callback }, skipWaiting: vi.fn(), clients: { claim: vi.fn() } },
  })
  return { listeners, caches, cache, fetch }
}

describe('learner offline cache isolation', () => {
  it('precaches the public library, handbook and reading bookmark script', async () => {
    const w = worker(); let done!: Promise<unknown>
    w.listeners.install({ waitUntil: (p: Promise<unknown>) => { done = p } })
    await done
    expect(w.cache.addAll).toHaveBeenCalledWith([
      '/mela-app/offline.html', '/mela-app/ai-year-one.html', '/mela-app/offline-progress.js',
    ])
  })
  it('only removes outdated learner caches on activation', async () => {
    const w = worker(); let done!: Promise<unknown>
    w.listeners.activate({ waitUntil: (p: Promise<unknown>) => { done = p } }); await done
    expect(w.caches.delete.mock.calls).toEqual([['mela-shell-v0'], ['mela-shell-v1'], ['mela-shell-v3-ai-review']])
  })
  it('does not intercept another app on the shared origin', () => {
    const w = worker(), respondWith = vi.fn()
    w.listeners.fetch({ request: { method: 'GET', url: 'https://example.test/Mela-central-dashboard-/assets/app.js' }, respondWith })
    expect(respondWith).not.toHaveBeenCalled(); expect(w.fetch).not.toHaveBeenCalled()
  })
  it('does not replace the offline shell with an HTTP error page', async () => {
    const w = worker(); let response!: Promise<Response>
    w.fetch.mockResolvedValue(new Response('Unavailable', { status: 503, headers: { 'Content-Type': 'text/html' } }))
    w.listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://example.test/mela-app/' }, respondWith: (p: Promise<Response>) => { response = p }, waitUntil: vi.fn() })
    expect((await response).status).toBe(503); expect(w.cache.put).not.toHaveBeenCalled()
  })
  it('serves the owned offline shell when the network is unavailable', async () => {
    const w = worker(); let response!: Promise<Response>
    w.fetch.mockRejectedValue(new Error('offline')); w.cache.match.mockResolvedValue(new Response('MELA offline shell'))
    w.listeners.fetch({ request: { method: 'GET', mode: 'navigate', url: 'https://example.test/mela-app/' }, respondWith: (p: Promise<Response>) => { response = p } })
    expect(await (await response).text()).toBe('MELA offline shell')
    expect(w.caches.open).toHaveBeenCalledWith('mela-shell-v12-public-offline')
  })
})

it('does not save the lesson handbook over the app opening screen', async () => {
  const w = worker(); let response!: Promise<Response>
  w.fetch.mockResolvedValue(new Response('Lesson handbook', {headers: {'Content-Type': 'text/html'}}))
  w.listeners.fetch({request: {method: 'GET', mode: 'navigate', url: 'https://example.test/mela-app/ai-year-one.html'}, respondWith: (p: Promise<Response>) => {response = p}, waitUntil: vi.fn()})
  expect(await (await response).text()).toBe('Lesson handbook')
  expect(w.cache.put).toHaveBeenCalledWith('/mela-app/ai-year-one.html', expect.any(Response))
})

it('never caches auth callback URLs or intercepts APIs and writes', async () => {
  const w = worker()
  for (const request of [
    {method:'POST',url:'https://example.test/mela-app/assets/write.js'},
    {method:'GET',url:'https://project.supabase.co/rest/v1/profiles'},
    {method:'GET',url:'https://example.test/mela-app/private.pdf?token=secret'},
    {method:'GET',url:'https://example.test/mela-app/assets/app.js',headers:new Headers({Authorization:'Bearer private'})},
  ]) {
    const respondWith = vi.fn(); w.listeners.fetch({request,respondWith})
    expect(respondWith).not.toHaveBeenCalled()
  }
  let response!: Promise<Response>
  w.fetch.mockResolvedValue(new Response('callback shell',{headers:{'Content-Type':'text/html'}}))
  w.listeners.fetch({request:{method:'GET',mode:'navigate',url:'https://example.test/mela-app/?code=private'},respondWith:(p:Promise<Response>)=>{response=p},waitUntil:vi.fn()})
  await response
  expect(w.cache.put).not.toHaveBeenCalled()
})

it('opens the public handbook offline without needing a session or Javascript bundle', async () => {
  const w=worker();let response!:Promise<Response>
  w.fetch.mockRejectedValue(new Error('offline'));w.cache.match.mockResolvedValue(new Response('Public handbook'))
  w.listeners.fetch({request:{method:'GET',mode:'navigate',url:'https://example.test/mela-app/ai-year-one.html'},respondWith:(p:Promise<Response>)=>{response=p}})
  expect(await (await response).text()).toBe('Public handbook')
  expect(w.cache.match).toHaveBeenCalledWith('/mela-app/ai-year-one.html')
})
