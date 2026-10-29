import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { rewriteSupabaseConnectSrc } from './scripts/supabase-csp'

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
