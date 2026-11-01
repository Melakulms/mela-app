import type { User } from '@supabase/supabase-js'

/** Supabase Auth, not client-editable profile flags, is the contact source of truth.
 * A synthetic @beta.mela.invalid address deliberately confirmed by the
 * invitation service must NEVER count as a verified contact.
 */
export function hasVerifiedContact(user: Pick<User, 'email' | 'email_confirmed_at' | 'phone' | 'phone_confirmed_at'> | null | undefined): boolean {
  if (!user) return false
  const verifiedEmail = Boolean(
    user.email &&
    !user.email.toLowerCase().endsWith('@beta.mela.invalid') &&
    user.email_confirmed_at,
  )
  const verifiedPhone = Boolean(user.phone && user.phone_confirmed_at)
  return verifiedEmail || verifiedPhone
}

export function validContactPhone(phone: string): boolean {
  return /^\+[1-9][0-9]{7,14}$/.test(phone.trim())
}

/** The bot's single-use, username-bound verification is recorded in
 * server-controlled app_metadata, never raw_user_meta_data. It proves
 * control of a Telegram account, NOT phone/email ownership or adulthood.
 * This preserves the existing email-free path for basic MELA enrollment
 * while protected activities retain their own server-side requirements.
 */
export function hasTrustedTelegramSignup(user: Pick<User, 'email' | 'app_metadata'> | null | undefined): boolean {
  if (!user?.email?.toLowerCase().endsWith('@beta.mela.invalid')) return false
  const meta = user.app_metadata
  return meta?.mela_verification_method === 'telegram' &&
    typeof meta.telegram_verified_at === 'string' &&
    Number.isFinite(Date.parse(meta.telegram_verified_at))
}
