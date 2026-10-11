import { supabase } from './supabase'
import { normalizeLanguageCode } from '../i18n'

type SaveEducationInput = {
  stageKey: string
  grade: number | null
  school: string
  subjects: string[]
  interests: string[]
  goals: string[]
  preferredAreas: string[]
  skills: string[]
}

type PostgrestLikeError = {
  message?: unknown
  code?: unknown
  status?: unknown
  hint?: unknown
}

type SaveStep = 'loading account' | 'setting education level' | 'completing profile' | 'verifying saved profile'

/** A PostgREST failure is often a plain object, not a JavaScript Error. */
export function explainEducationSaveError(cause: unknown, step: SaveStep): string {
  const value = cause && typeof cause === 'object' ? cause as PostgrestLikeError : {}
  const raw = typeof value.message === 'string' ? value.message : cause instanceof Error ? cause.message : ''
  const code = typeof value.code === 'string' && /^[A-Za-z0-9_-]{2,30}$/.test(value.code) ? value.code : ''
  const prefix = `Couldn't finish ${step}.`
  const advice = code === '42501' || /permission denied|row.level.security|violates row-level/i.test(raw)
    ? ' The database denied this change. MELA support needs to check this account’s authorized profile permissions.'
    : code === 'PGRST202' || code === '42883'
      ? ' This database function is unavailable. MELA support must check which migrations are installed.'
      : /role_selected_at|account type selection/i.test(raw)
        ? ' Your account type has not been verified by the server. Contact MELA support.'
        : /verified active account required/i.test(raw)
          ? ' Your account must be active and verified before completing this profile.'
          : /education stage is locked/i.test(raw)
            ? ' Your established education level cannot be changed without a verified correction.'
            : ''
  // Display a short server message and SQLSTATE, not URLs, HTTP headers, credentials or a full response object.
  const message = raw
    .replace(/Bearer\s+[A-Za-z0-9_.-]+/gi, '[redacted]')
    .replace(/(?:apikey|access_token|refresh_token|password)\s*[:=]\s*[^\s,;}]+/gi, '[redacted]')
    .slice(0, 300)
  return `${prefix}${advice}${message ? ' Server: ' + message : ' The server did not return a readable error.'}${code ? ' (code ' + code + ')' : ''}`
}

function savedProfileIsValid(
  saved: { education_stage_key?: string | null; grade_level?: number | null; education_onboarding_completed?: boolean } | null,
  input: SaveEducationInput,
): boolean {
  return !!saved && saved.education_stage_key === input.stageKey &&
    (input.grade === null || saved.grade_level === input.grade) &&
    saved.education_onboarding_completed === true
}

/**
 * Uses existing authenticated, account-scoped profile RPCs and verifies
 * persisted values. Missing server functions or denied permissions are real
 * errors: do not retry through weaker client-side writes.
 */
export async function saveMyEducationProfile(input: SaveEducationInput): Promise<void> {
  let step: SaveStep = 'loading account'
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!auth.user) throw new Error('Please sign in again before saving your profile.')
    const id = auth.user.id
    const { data: current, error: currentError } = await supabase.from('profiles')
      .select('full_name,preferred_language,role,education_stage_key,grade_level,education_onboarding_completed,role_selected_at')
      .eq('id', id).maybeSingle()
    if (currentError) throw currentError
    if (!current || current.role !== 'student') throw new Error('An active student profile is required to save education details.')
    if (current.education_stage_key && current.education_stage_key !== input.stageKey) {
      throw new Error('Your established education level can only be changed after verified review by MELA support.')
    }
    if (!current.role_selected_at) {
      throw new Error('Your account type is not marked as selected in the live database. A verified administrator must complete account type onboarding.')
    }
    if (current.grade_level !== null && input.grade !== null && current.grade_level !== input.grade) {
      // A learner whose profile is genuinely complete must not be allowed
      // to self-change grade. A stranded, incomplete onboarding may correct
      // the grade inside its pre-existing school stage via the validated RPC.
      const {data: saved, error: savedError} = await supabase.from('student_profiles')
        .select('subjects').eq('user_id', id).maybeSingle()
      if (savedError) throw savedError
      if (current.education_onboarding_completed && Array.isArray(saved?.subjects) && saved.subjects.length > 0) {
        throw new Error('Your established grade requires a verified school-year promotion or correction by MELA support.')
      }
    }

    step = 'setting education level'
    if (!current.education_stage_key || (input.grade !== null && current.grade_level !== input.grade)) {
      const { error: stageError } = await supabase.rpc('set_my_education_stage_v36', {
        p_stage_key: input.stageKey,
        p_grade_level: input.grade,
        p_institution_name: input.school.trim() || null,
      })
      if (stageError) throw stageError
    }

    step = 'completing profile'
    const fullName = String(current.full_name ?? '').trim()
    if (fullName.length < 2) throw new Error('Your account is missing a full name. Ask MELA support to correct the account before retrying.')
    const { error: completionError } = await supabase.rpc('complete_my_profile_v37', {
      p_full_name: fullName,
      p_preferred_language: normalizeLanguageCode(current.preferred_language),
      p_institution_name: input.school.trim() || null,
      p_details: {
        subjects: input.subjects,
        learning_interests: input.interests,
        goals: input.goals,
        preferred_learning_areas: input.preferredAreas,
        skills: input.skills,
      },
    })
    if (completionError) throw completionError

    step = 'verifying saved profile'
    const { data: savedProfile, error: profileError } = await supabase.from('profiles')
      .select('education_stage_key,grade_level,education_onboarding_completed')
      .eq('id', id).maybeSingle()
    if (profileError) throw profileError
    if (!savedProfileIsValid(savedProfile, input)) {
      throw new Error('The server could not confirm that your education level and grade were saved.')
    }
    const { data: savedSubjects, error: subjectsError } = await supabase.from('student_profiles')
      .select('subjects').eq('user_id', id).maybeSingle()
    if (subjectsError) throw subjectsError
    if (!Array.isArray(savedSubjects?.subjects) ||
        !input.subjects.every(subject => savedSubjects.subjects.includes(subject))) {
      throw new Error('The server did not save every selected subject.')
    }
  } catch (cause) {
    throw new Error(explainEducationSaveError(cause, step))
  }
}
