import { supabase } from './supabase'

export interface StudyMaterial {
  id: string
  title: string
  subject: string
  file_url: string
}

export async function fetchMaterials(): Promise<StudyMaterial[]> {
  const { data, error } = await supabase
    .from('study_materials')
    .select('id, title, subject, file_url')
    .order('subject')
  if (error) throw error
  return data as StudyMaterial[]
}
