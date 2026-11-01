import { supabase } from './supabase'

export type DraftRole = 'parent' | 'teacher' | 'company'
const ALLOWED_FIELDS: Record<DraftRole, readonly string[]> = {
  parent: ['name','region','city','occupation','interests'],
  teacher: ['name','institution','qualification','subjects','grades','years','skills','bio'],
  company: ['name','company','legalName','regNumber','industry','website','title','description'],
}
const MAX_CHARS = 1600
const MAX_BYTES = 8192

/** Avoid accidentally storing passwords, tokens, birth dates, identity documents,
 * contact verification codes or child-link secrets in a draft.
 */
export function sanitizedProfileDraft(role: DraftRole, input: Record<string, unknown>): Record<string, string | string[]> {
  const sanitized: Record<string, string | string[]> = {}
  for (const key of ALLOWED_FIELDS[role]) {
    const value = input[key]
    if (typeof value === 'string') {
      sanitized[key] = value.slice(0, MAX_CHARS)
    } else if (key === 'grades' && Array.isArray(value)) {
      sanitized.grades = value.filter((item): item is string => typeof item === 'string' && (
        ['college_tvet','university'].includes(item) ||
        (/^(?:[1-9]|1[0-2])$/.test(item))
      )).slice(0,14)
    }
  }
  if (new TextEncoder().encode(JSON.stringify(sanitized)).length > MAX_BYTES) {
    throw new Error('Your draft is too long. Shorten the description or subject list before saving.')
  }
  return sanitized
}

async function authenticatedUserId(): Promise<string> {
  const {data,error} = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user?.id) throw new Error('Please sign in again before saving your profile.')
  return data.user.id
}

export async function loadProfileDraft(role: DraftRole) {
  const id = await authenticatedUserId()
  const {data,error} = await supabase.from('profile_onboarding_drafts')
    .select('draft').eq('user_id',id).eq('role',role).maybeSingle()
  if (error) throw error
  return data?.draft && typeof data.draft === 'object' && !Array.isArray(data.draft)
    ? sanitizedProfileDraft(role,data.draft as Record<string,unknown>)
    : null
}

export async function saveProfileDraft(role: DraftRole, input: Record<string,unknown>): Promise<void> {
  const id = await authenticatedUserId()
  const draft = sanitizedProfileDraft(role,input)
  const {error} = await supabase.from('profile_onboarding_drafts')
    .upsert({user_id:id,role,draft,updated_at:new Date().toISOString()},{onConflict:'user_id,role'})
  if (error) throw error
}

export async function clearProfileDraft(role: DraftRole): Promise<void> {
  const id = await authenticatedUserId()
  const {error} = await supabase.from('profile_onboarding_drafts')
    .delete().eq('user_id',id).eq('role',role)
  if (error) throw error
}
