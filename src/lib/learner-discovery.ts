// Load the API client only during an authenticated call. Pure matching helpers stay testable offline.
const getClient = async () => (await import('./supabase')).supabase

export type DegreeGoal = 'any' | 'high_school' | 'diploma' | 'bachelor' | 'master' | 'doctorate'
export type LearnerDiscoveryProfile = {
  preferred_program_keys: string[]
  interest_fields: string[]
  preferred_study_countries: string[]
  target_degree_level: DegreeGoal
  learning_goal: string
  enable_suggestions: boolean
}

export type GradeProgram = { program_key: string; subject_title: string; grade_level: number | null; track_key: string; stage_key: string }

export const EMPTY_DISCOVERY_PROFILE: LearnerDiscoveryProfile = {
  preferred_program_keys: [],
  interest_fields: [],
  preferred_study_countries: [],
  target_degree_level: 'any',
  learning_goal: '',
  enable_suggestions: true,
}

export const SCHOOL_STAGE_FOR_GRADE = (grade: number) =>
  grade <= 6 ? 'school_1_6' : grade <= 8 ? 'school_7_8' : grade <= 10 ? 'school_9_10' : 'school_11_12'

const textArray = (values: string[], limit: number) =>
  [...new Set(values.map(value => value.trim()).filter(Boolean))].slice(0, limit)

async function currentUser() {
  const supabase = await getClient()
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in to manage your discovery profile.')
  return data.user.id
}

export async function fetchGradePrograms(grade: number, track: string): Promise<GradeProgram[]> {
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return []
  const stage = SCHOOL_STAGE_FOR_GRADE(grade)
  const supabase = await getClient()
  const { data, error } = await supabase.from('mela_learning_programs')
    .select('program_key,subject_title,grade_level,track_key,stage_key')
    .eq('active', true).eq('program_kind', 'school_subject')
    .eq('stage_key', stage).eq('grade_level', grade)
    .in('track_key', grade >= 11 ? ['common', track] : ['common'])
    .order('subject_title')
  if (error) throw error
  return (data ?? []) as GradeProgram[]
}

export async function fetchLearnerDiscoveryProfile(): Promise<LearnerDiscoveryProfile> {
  const id = await currentUser()
  const supabase = await getClient()
  const { data, error } = await supabase.from('mela_learner_discovery_preferences')
    .select('preferred_program_keys,interest_fields,preferred_study_countries,target_degree_level,learning_goal,enable_suggestions')
    .eq('user_id', id).maybeSingle()
  if (error) throw error
  return { ...EMPTY_DISCOVERY_PROFILE, ...(data ?? {}) }
}

export async function saveLearnerDiscoveryProfile(value: LearnerDiscoveryProfile): Promise<void> {
  const id = await currentUser()
  const supabase = await getClient()
  const goals: DegreeGoal[] = ['any','high_school','diploma','bachelor','master','doctorate']
  if (!goals.includes(value.target_degree_level) || value.learning_goal.length > 300) throw new Error('Invalid discovery preferences.')
  const { error } = await supabase.from('mela_learner_discovery_preferences').upsert({
    user_id: id,
    preferred_program_keys: textArray(value.preferred_program_keys, 30),
    interest_fields: textArray(value.interest_fields, 15),
    preferred_study_countries: textArray(value.preferred_study_countries, 10),
    target_degree_level: value.target_degree_level,
    learning_goal: value.learning_goal.trim(),
    enable_suggestions: value.enable_suggestions,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
  if (error) throw error
}

/** Suggestions provide ordering, not an admission, age, country, or funding eligibility decision. */
export function rankScholarships<T extends {
  title: string; fields_of_study: string[]; study_country: string | null;
  degree_levels: string[]; program_name: string | null; deadline: string | null
}>(scholarships: T[], preferences: LearnerDiscoveryProfile): { item: T; score: number; reasons: string[] }[] {
  if (!preferences.enable_suggestions) return scholarships.map(item => ({ item, score: 0, reasons: [] }))
  const interests = preferences.interest_fields.map(x => x.toLowerCase()).filter(Boolean)
  const countries = preferences.preferred_study_countries.map(x => x.toLowerCase()).filter(Boolean)
  const targetDegree = preferences.target_degree_level
  return scholarships.map(item => {
    let score = 0
    const reasons: string[] = []
    const fields = [item.title, item.program_name ?? '', ...(item.fields_of_study ?? [])].join(' ').toLowerCase()
    if (interests.some(interest => fields.includes(interest))) {
      score += 4; reasons.push('Matches a field you selected')
    }
    if (countries.length && item.study_country && countries.includes(item.study_country.toLowerCase())) {
      score += 3; reasons.push('In a study country you prefer')
    }
    if (targetDegree !== 'any' && item.degree_levels?.some(level => level.toLowerCase().includes(targetDegree))) {
      score += 2; reasons.push('Lists your preferred degree level')
    }
    return { item, score, reasons }
  }).sort((a, b) => b.score - a.score || String(a.item.deadline || '9999').localeCompare(String(b.item.deadline || '9999')))
}

export function rankOpportunities<T extends { title: string; summary: string | null; skills_required?: string[] | null }>(
  opportunities: T[], preferences: LearnerDiscoveryProfile,
): { item: T; score: number; reason: string }[] {
  if (!preferences.enable_suggestions) return opportunities.map(item => ({ item, score: 0, reason: '' }))
  const interests = preferences.interest_fields.map(x => x.toLowerCase()).filter(Boolean)
  return opportunities.map(item => {
    const words = [item.title, item.summary ?? '', ...(item.skills_required ?? [])].join(' ').toLowerCase()
    const matches = interests.filter(interest => words.includes(interest))
    return { item, score: matches.length, reason: matches.length ? 'Matches interests in your profile' : '' }
  }).sort((a,b) => b.score - a.score)
}

export function isSchoolStage(stage: string | null | undefined): boolean {
  return !!stage?.startsWith('school_')
}
