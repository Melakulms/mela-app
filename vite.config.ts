import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const PRODUCTION_SUPABASE = 'https://duizgtmbptmlbyipreqg.supabase.co'
const STAGING_SUPABASE = 'https://tungqfmypuwzeyrtaseh.supabase.co'
const PRODUCTION_CONNECT_SRC = `connect-src 'self' ${PRODUCTION_SUPABASE} wss://duizgtmbptmlbyipreqg.supabase.co;`

/**
 * Keep the live GitHub Pages CSP strictly production-only. For a build that
 * explicitly targets the separate staging Supabase project, swap the two
 * allowed API/WebSocket origins. Never add both projects to one build.
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? ''

  return {
    plugins: [
      react(),
      {
        name: 'mela-isolated-supabase-csp',
        transformIndexHtml: (html: string) => rewriteSupabaseConnectSrc(html, supabaseUrl),
      },
    ],
    base: '/mela-app/',
  }
})
