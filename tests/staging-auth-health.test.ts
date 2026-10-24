import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from '../api/health.js'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('staging-only Auth health diagnostic', () => {
  it('fails closed if the public staging health-check config is not available', async () => {
    vi.stubEnv('MELA_STAGING_PUBLISHABLE_KEY', '')
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    const response = await GET()
    expect(response.status).toBe(503)
    expect(request).not.toHaveBeenCalled()
    const details = await response.json()
    expect(details.environment).toBe('staging')
    expect(details.auth_health_confirmed).toBe(false)
    expect(details.sign_in_ready).toBe(false)
  })

  it('checks only staging GoTrue health with the public key; does not claim verified sign-in', async () => {
    vi.stubEnv('MELA_STAGING_PUBLISHABLE_KEY', 'sb_publishable_public_test_only')
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'GoTrue' }),{
      status: 200,
      headers: {'content-type':'application/json'}
    }))
    vi.stubGlobal('fetch', request)
    const response = await GET()
    expect(response.status).toBe(200)
    expect(request).toHaveBeenCalledOnce()
    const url = request.mock.calls[0][0]
    expect(url).toBe('https://tungqfmypuwzeyrtaseh.supabase.co/auth/v1/health')
    const result=await response.json()
    expect(result.auth_health_confirmed).toBe(true)
    expect(result.sign_in_ready).toBe(false)
    expect(result.project_ref).toBe('tungqfmypuwzeyrtaseh')
    expect(JSON.stringify(result)).not.toContain('sb_publishable')
  })

  it('does not declare readiness when Auth health fails', async () => {
    vi.stubEnv('MELA_STAGING_PUBLISHABLE_KEY', 'sb_publishable_public_test_only')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}',{status:503,headers:{'content-type':'application/json'}})))
    const response = await GET()
    expect(response.status).toBe(503)
    expect((await response.json()).auth_health_confirmed).toBe(false)
  })
})
