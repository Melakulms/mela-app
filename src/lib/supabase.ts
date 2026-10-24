import { initialAuthCallbackError } from './auth-redirect'
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Missing Supabase public configuration')
}

// This staging branch must fail closed unless pointed only at its isolated database.
if (import.meta.env.VITE_MELA_STAGING === 'true' && (
  url !== 'https://tungqfmypuwzeyrtaseh.supabase.co' || !key.startsWith('sb_publishable_')
)) {
  throw new Error('Blocked unsafe MELA staging backend configuration')
}

// GitHub Pages serves both MELA apps on the same origin. Supabase's default
// storage key would silently reuse the other app's logged-in session.
// Separate namespaces keep learner and central-admin sign-ins independent.
// Existing shared-key sessions intentionally require a fresh sign-in once.
export const AUTH_STORAGE_KEY = import.meta.env.VITE_MELA_STAGING === 'true' ? 'mela-staging-users-supabase-auth-v1' : 'mela-users-supabase-auth-v1'
void initialAuthCallbackError
export const supabase = createClient(url, key, { auth: { storageKey: AUTH_STORAGE_KEY } })
