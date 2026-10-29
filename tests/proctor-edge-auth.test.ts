// @vitest-environment node
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { expect, it, vi } from 'vitest'

function harness(adminAllowed: boolean, validUser = true) {
  const token = `header.${Buffer.from(JSON.stringify({ sub: 'user-1' })).toString('base64url')}.signature`
  let handler!: (request: Request) => Promise<Response>
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/rpc/platform_feature_available')) return Response.json(true)
    if (url.endsWith('/auth/v1/user')) return Response.json(validUser ? { id: 'user-1' } : {}, { status: validUser ? 200 : 401 })
    if (url.endsWith('/rpc/is_admin_user')) return Response.json(adminAllowed)
    if (url.endsWith('/proctor_reviews')) return Response.json([{ id: 'review-1' }])
    throw new Error(`Unexpected request: ${url}`)
  })
  const source = readFileSync('supabase/functions/mela-proctor/index.ts', 'utf8').replace('import "jsr:@supabase/functions-js/edge-runtime.d.ts";', '')
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText
  new Function('Deno', 'fetch', js)({
    env: { get: (name: string) => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service', SUPABASE_ANON_KEY: 'test-anon' }[name]) },
    serve: (fn: typeof handler) => { handler = fn },
  }, fetchMock)
  return { fetchMock, token, request: () => handler(new Request('https://test/functions/v1/mela-proctor', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'review', attempt_id: '00000000-0000-4000-8000-000000000110', decision: 'clear' }),
  })) }
}

it('blocks review if database MFA/active-admin authorization fails', async () => {
  const h = harness(false)
  expect((await h.request()).status).toBe(403)
  expect(h.fetchMock.mock.calls.some(([url]) => url.endsWith('/proctor_reviews'))).toBe(false)
  const authCall = h.fetchMock.mock.calls.find(([url]) => url.endsWith('/rpc/is_admin_user'))!
  expect(new Headers(authCall[1]?.headers).get('Authorization')).toBe(`Bearer ${h.token}`)
})

it('rejects invalid user sessions before checking admin access or writing', async () => {
  const h = harness(true, false)
  expect((await h.request()).status).toBe(401)
  expect(h.fetchMock.mock.calls.some(([url]) => url.endsWith('/rpc/is_admin_user') || url.endsWith('/proctor_reviews'))).toBe(false)
})

it('preserves review behavior only after database authorization succeeds', async () => {
  const h = harness(true)
  const response = await h.request()
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ review: { id: 'review-1' } })
  const write = h.fetchMock.mock.calls.find(([url]) => url.endsWith('/proctor_reviews'))!
  expect(JSON.parse(String(write[1]?.body)).reviewer_id).toBe('user-1')
})
