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
