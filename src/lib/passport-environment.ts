/** Presentation gate only. The database RLS, verification triggers and column grants
 * provide authoritative access control. Avoid enabling editors against an unverified backend.
 */
const VERIFIED_MELA_BACKENDS = new Set([
  'duizgtmbptmlbyipreqg.supabase.co',
  'tungqfmypuwzeyrtaseh.supabase.co',
])
export function passportRecordEditorsEnabled(serviceUrl: string | undefined | null): boolean {
  if (!serviceUrl) return false
  try {
    const url = new URL(serviceUrl)
    return url.protocol === 'https:' &&
      url.pathname === '/' &&
      url.search === '' && url.hash === '' &&
      !url.port && !url.username && !url.password &&
      VERIFIED_MELA_BACKENDS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}
