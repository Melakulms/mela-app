import { supabase } from './supabase'
import { normalizeLanguageCode } from '../i18n'

type SaveEducationInput = {
  stageKey: string
  grade: number | null
  school: string
  subjects: string[]
  interests: string[]
  goals: string[]
}

type PostgrestLikeError = {
  message?: unknown
  code?: unknown
  status?: unknown
  hint?: unknown
}

type SaveStep = 'loading account' | 'setting education level' | 'saving your subjects' | 'completing profile' | 'verifying saved profile'

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

function unavailableRpc(cause: PostgrestLikeError | null): boolean {
  return cause?.code === 'PGRST202' || cause?.code === '42883'
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
 * Uses the existing authenticated, account-scoped profile RPCs first. If an
 * older backend lacks these RPCs, fall back only on authenticated self-row
 * updates; never retry a security or validation denial through a weaker path.
 */
export async function saveMyEducationProfile(input: SaveEducationInput): Promise<void> {
  let step: SaveStep = 'loading account'
  try {
    const { data: auth, error: authError } = await supabase.auth.getUser()
    if (authError) throw authError
    if (!auth.user) throw new Error('Please sign in again before saving your profile.')
    const id = auth.user.id
    const { data: current, error: currentError } = await supabase.from('profiles')
      .select('full_name,preferred_language,role,education_stage_key,grade_level')
      .eq('id', id).maybeSingle()
    if (currentError) throw currentError
    if (!current || current.role !== 'student') throw new Error('An active student profile is required to save education details.')
    if (current.education_stage_key && current.education_stage_key !== input.stageKey) {
      throw new Error('Your established education level can only be changed after verified review by MELA support.')
    }
    if (current.grade_level !== null && input.grade !== null && current.grade_level !== input.grade) {
      throw new Error('Your school grade can only be changed after a verified correction by MELA support.')
    }

    step = 'setting education level'
    if (!current.education_stage_key) {
      const { error: stageError } = await supabase.rpc('set_my_education_stage_v36', {
        p_stage_key: input.stageKey,
        p_grade_level: input.grade,
        p_institution_name: input.school.trim() || null,
      })
      if (stageError) {
        if (!unavailableRpc(stageError)) throw stageError
        // Compatibility only for a server without v36; an RLS rejection must
        // be presented, not suppressed.
        const { data: legacyStage, error: legacyStageError } = await supabase.from('profiles')
          .update({ education_stage_key: input.stageKey, grade_level: input.grade })
          .eq('id', id).select('education_stage_key,grade_level').maybeSingle()
        if (legacyStageError) throw legacyStageError
        if (legacyStage?.education_stage_key !== input.stageKey ||
            (input.grade !== null && legacyStage.grade_level !== input.grade)) {
          throw new Error('The server did not accept your education level. Your account may need verified onboarding permissions.')
        }
      }
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
      },
    })
    if (completionError) {
      if (!unavailableRpc(completionError)) throw completionError
      step = 'saving your subjects'
      const { error: subjectsError } = await supabase.from('student_profiles')
        .upsert({
          user_id: id,
          school_name: input.school.trim() || null,
          subjects: input.subjects,
          learning_interests: input.interests,
          goals: input.goals,
        }, { onConflict: 'user_id' })
      if (subjectsError) throw subjectsError
      const { data: legacyProfile, error: legacyProfileError } = await supabase.from('profiles')
        .update({
          education_onboarding_completed: true,
          onboarding_step: 'completed',
          institution_name: input.school.trim() || null,
        }).eq('id', id).select('education_stage_key,grade_level,education_onboarding_completed').maybeSingle()
      if (legacyProfileError) throw legacyProfileError
      if (!savedProfileIsValid(legacyProfile, input)) {
        throw new Error('The server did not confirm your education profile after saving subjects.')
      }
    }

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
