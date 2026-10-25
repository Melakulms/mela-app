import { supabase } from './supabase'
import { educationStageFor } from './education-profile'
import { eligibleSchoolPrograms, type CurriculumSubject } from './curriculum-access'

export interface LearningMaterial {
  material_key: string
  material_type: string
  title: string
  summary: string | null
  access_tier: 'free' | 'subscription' | 'one_time'
  estimated_minutes: number | null
  can_access: boolean
}

export interface LearningUnit {
  id: string
  unit_number: number
  title: string
  materials: LearningMaterial[]
}

export interface LearningProgram {
  program_key: string
  subject_key: string
  grade_level: number | null
  track_key: string
  subject_title: string
  title: string
  description: string | null
  units: LearningUnit[]
}

export interface LearningProduct {
  product_key: string
  product_name: string
  active_price_minor: number
  currency: string
  description: string | null
}

export interface LearningLibrary {
  programs: LearningProgram[]
  products: LearningProduct[]
}

export async function fetchLearningLibrary(stageKey: string, gradeLevel: number | null = null, trackKey: string | null = null): Promise<LearningLibrary> {
  const { data, error } = await supabase.rpc('get_mela_learning_library', {
    p_stage_key: stageKey, p_grade_level: gradeLevel, p_track_key: trackKey,
  })
  if (error) throw error
  const library = data as LearningLibrary
  if (!stageKey.startsWith('school_')) return library

  // A requested stage, grade, or stream must never override saved enrollment.
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error('Sign in to load your registered school subjects.')
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('education_stage_key,grade_level').eq('id',auth.user.id).maybeSingle()
  if (profileError) throw profileError
  const savedGrade = profile?.grade_level == null ? null : Number(profile.grade_level)
  if (savedGrade === null || savedGrade !== gradeLevel ||
      stageKey !== profile?.education_stage_key || educationStageFor('school',savedGrade) !== stageKey) {
    throw new Error('Your saved grade does not match these materials. Complete or correct your education profile.')
  }
  const { data: student, error: studentError } = await supabase.from('student_profiles')
    .select('subjects').eq('user_id',auth.user.id).maybeSingle()
  if (studentError) throw studentError
  const enrolled = Array.isArray(student?.subjects) ? student.subjects as string[] : []
  if (!enrolled.length) throw new Error('Save your curriculum subjects in Profile before opening school materials.')
  const { data: catalog, error: catalogError } = await supabase.from('mela_national_subject_catalog')
    .select('stage_key,track_key,subject_key,optional').eq('active',true).eq('stage_key',stageKey)
  if (catalogError) throw catalogError
  const eligible = eligibleSchoolPrograms(
    (library.programs ?? []).map(p=>({...p,stage_key:stageKey})),
    (catalog ?? []) as CurriculumSubject[],savedGrade,stageKey,enrolled,
  )
  return {...library,programs:eligible}
}

export interface MaterialContent {
  material_key: string
  title: string
  summary: string | null
  content_markdown?: string | null
  locked: boolean
}

export async function fetchLearningMaterial(materialKey: string): Promise<MaterialContent> {
  const { data, error } = await supabase.rpc('get_mela_learning_material', { p_material_key: materialKey })
  if (error) throw error
  if (!data) throw new Error('This learning material is unavailable.')
  return data as MaterialContent
}
