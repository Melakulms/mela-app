import { supabase } from './supabase'
import { safeExternalUrl } from './external-url'

export type RecordKind = 'education' | 'experience' | 'projects'
export type PassportRecord = { id: string; institution?: string; qualification?: string | null; field_of_study?: string | null; organization?: string; title?: string; description?: string | null; project_url?: string | null; repository_url?: string | null; verified?: boolean; is_public: boolean }
const tables = { education: 'profile_education', experience: 'profile_experience', projects: 'profile_projects' } as const
const columns = { education: 'id,institution,qualification,field_of_study,description,verified,is_public', experience: 'id,organization,title,description,verified,is_public', projects: 'id,title,description,project_url,repository_url,is_public' } as const
async function owner() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Please sign in again to load your passport records.')
  return data.user.id
}
export async function fetchPassportRecords(kind: RecordKind, offset = 0): Promise<PassportRecord[]> {
  const userId = await owner()
  const { data, error } = await supabase.from(tables[kind]).select(columns[kind]).eq('user_id', userId).order('created_at', { ascending: false }).order('id').range(offset, offset + 19)
  if (error) throw error
  return (data ?? []) as unknown as PassportRecord[]
}
export type ProjectDraft = { title: string; description: string; project_url: string; repository_url: string; is_public: boolean }
export function projectPayload(draft: ProjectDraft) {
  const title = draft.title.trim()
  if (!title || title.length > 200) throw new Error('Enter a project title of 1–200 characters.')
  if (draft.description.trim().length > 5000) throw new Error('Keep the description within 5,000 characters.')
  const link = (value: string) => {
    if (!value.trim()) return null
    const url = safeExternalUrl(value.trim())
    if (!url || !url.startsWith('https:')) throw new Error('Use a public HTTPS link without passwords or credentials.')
    return url
  }
  return { title, description: draft.description.trim() || null, project_url: link(draft.project_url), repository_url: link(draft.repository_url), is_public: draft.is_public === true }
}
export async function savePassportProject(draft: ProjectDraft, id?: string): Promise<PassportRecord> {
  const payload = projectPayload(draft)
  const userId = await owner()
  const query = id
    ? supabase.from('profile_projects').update(payload).eq('id', id).eq('user_id', userId)
    : supabase.from('profile_projects').insert({ ...payload, user_id: userId })
  const { data, error } = await query.select(columns.projects).single()
  if (error) throw error
  if (!data) throw new Error('The project was not saved. Please retry.')
  return data as PassportRecord
}
