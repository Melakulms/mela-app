const PRODUCTION_SUPABASE = 'https://duizgtmbptmlbyipreqg.supabase.co'
const STAGING_SUPABASE = 'https://tungqfmypuwzeyrtaseh.supabase.co'
const PRODUCTION_CONNECT_SRC = `connect-src 'self' ${PRODUCTION_SUPABASE} wss://duizgtmbptmlbyipreqg.supabase.co;`

/**
 * Production GitHub Pages must only reach production Supabase.
 * Staging builds must only reach staging Supabase.
 * The exact configured staging URL is the only opt-in to the staging CSP.
 */
export function rewriteSupabaseConnectSrc(html: string, configuredUrl: string): string {
  if (configuredUrl.trim().replace(/\/+$/, '') !== STAGING_SUPABASE) return html

  if (!html.includes(PRODUCTION_CONNECT_SRC)) {
    throw new Error('MELA index.html production CSP marker is missing; refusing staging build')
  }

  return html.replace(
    PRODUCTION_CONNECT_SRC,
    `connect-src 'self' ${STAGING_SUPABASE} wss://tungqfmypuwzeyrtaseh.supabase.co;`,
  )
}
