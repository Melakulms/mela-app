import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages publishes MELA at /mela-app/. The separately configured staging
// Vercel project serves its preview from /, without modifying production.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const staging = env.VITE_MELA_STAGING === 'true' || env.VITE_MELA_STAGING === '1'
  const configured = env.VITE_SUPABASE_URL
  const fallback = 'https://duizgtmbptmlbyipreqg.supabase.co'
  if (staging && !configured) throw new Error('Staging preview requires its own Supabase URL')
  const url = new URL(configured || fallback)
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/'
      || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname)) {
    throw new Error('Invalid Supabase URL for MELA Content Security Policy')
  }
  const connectOrigins = url.origin + ' wss://' + url.hostname
  return {
    plugins: [
      react(),
      {
        name: 'mela-supabase-connect-csp',
        transformIndexHtml(html: string) {
          if (!html.includes('__MELA_SUPABASE_CONNECT_ORIGINS__'))
            throw new Error('Missing MELA CSP target placeholder')
          return html.replace('__MELA_SUPABASE_CONNECT_ORIGINS__', connectOrigins)
        },
      },
    ],
    base: staging ? '/' : '/mela-app/',
  }
})
