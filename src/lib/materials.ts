import { supabase } from './supabase'

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

export async function fetchLearningLibrary(stageKey: string): Promise<LearningLibrary> {
  const { data, error } = await supabase.rpc('get_mela_learning_library', {
    p_stage_key: stageKey, p_grade_level: null, p_track_key: null,
  })
  if (error) throw error
  return data as LearningLibrary
}
