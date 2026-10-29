import { describe, expect, it } from 'vitest'
import { rewriteSupabaseConnectSrc } from '../vite.config'

const prod = 'duizgtmbptmlbyipreqg.supabase.co'
const stage = 'tungqfmypuwzeyrtaseh.supabase.co'
const original = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; connect-src 'self' https://${prod} wss://${prod}; worker-src 'self'">`

describe('isolated Supabase content-security policy', () => {
  it('uses only staging HTTPS and WSS origins in staging builds', () => {
    const html = rewriteSupabaseConnectSrc(original, `https://${stage}/`)
    expect(html).toContain(`connect-src 'self' https://${stage} wss://${stage};`)
    expect(html).not.toContain(`https://${prod}`)
    expect(html).not.toContain(`wss://${prod}`)
  })

  it('does not expose staging in production builds', () => {
    for (const url of [`https://${prod}`, '', 'https://example.supabase.co']) {
      const html = rewriteSupabaseConnectSrc(original, url)
      expect(html).toBe(original)
      expect(html).not.toContain(stage)
    }
  })

  it('refuses to silently ship a staging build if the CSP template has changed', () => {
    expect(() => rewriteSupabaseConnectSrc('<html></html>', `https://${stage}`))
      .toThrow(/production CSP marker is missing/)
  })
})
