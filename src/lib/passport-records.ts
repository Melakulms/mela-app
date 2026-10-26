import { supabase } from './supabase'
import { safeExternalUrl } from './external-url'

export type RecordKind = 'education' | 'experience' | 'projects'
export type PassportRecord = { id: string; institution?: string; qualification?: string | null; field_of_study?: string | null; organization?: string; title?: string; description?: string | null; project_url?: string | null; repository_url?: string | null; verified?: boolean; is_public: boolean; start_year?: number | null; end_year?: number | null; grade?: string | null; is_current?: boolean; experience_type?: string | null; start_date?: string | null; end_date?: string | null }
const tables = { education: 'profile_education', experience: 'profile_experience', projects: 'profile_projects' } as const
const columns = { education: 'id,institution,qualification,field_of_study,start_year,end_year,grade,is_current,description,verified,is_public', experience: 'id,organization,title,experience_type,start_date,end_date,is_current,description,verified,is_public', projects: 'id,title,description,project_url,repository_url,is_public' } as const
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
  return data as unknown as PassportRecord
}

export type CareerRecordKind = Exclude<RecordKind, 'projects'>
export type EducationDraft = {
  institution: string; qualification: string; field_of_study: string
  start_year: string; end_year: string; grade: string
  is_current: boolean; description: string
}
export type ExperienceDraft = {
  organization: string; title: string; experience_type: string
  start_date: string; end_date: string; is_current: boolean; description: string
}
function plain(value: string, label: string, max: number, required = false) {
  const clean = value.trim()
  if ((required && !clean) || clean.length > max) {
    throw new Error(label + (required ? ' is required' : ' is too long') + ' (maximum ' + max + ' characters).')
  }
  return clean || null
}
function year(value: string) {
  if (!value.trim()) return null
  if (!/^\d{4}$/.test(value)) throw new Error('Use a four-digit year.')
  const result = Number(value)
  if (result < 1900 || result > new Date().getFullYear() + 2) throw new Error('Check the education year.')
  return result
}
function date(value: string) {
  if (!value.trim()) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value)) || new Date(value + 'T00:00:00Z').toISOString().slice(0,10) !== value) {
    throw new Error('Use a valid date.')
  }
  return value
}
export function educationPayload(draft: EducationDraft) {
  const start_year = year(draft.start_year)
  const end_year = draft.is_current ? null : year(draft.end_year)
  if (start_year && end_year && end_year < start_year) throw new Error('End year cannot precede start year.')
  return {
    institution: plain(draft.institution, 'Institution', 200, true),
    qualification: plain(draft.qualification, 'Qualification', 200),
    field_of_study: plain(draft.field_of_study, 'Field of study', 200),
    start_year, end_year,
    is_current: draft.is_current === true,
    grade: plain(draft.grade, 'Grade', 40),
    description: plain(draft.description, 'Description', 3000),
    is_public: false,
  }
}
export function experiencePayload(draft: ExperienceDraft) {
  const start_date = date(draft.start_date)
  const end_date = draft.is_current ? null : date(draft.end_date)
  if (start_date && end_date && end_date < start_date) throw new Error('End date cannot precede start date.')
  return {
    organization: plain(draft.organization, 'Organization', 200, true),
    title: plain(draft.title, 'Role or position', 200, true),
    experience_type: plain(draft.experience_type, 'Experience type', 60) || 'work',
    start_date, end_date,
    is_current: draft.is_current === true,
    description: plain(draft.description, 'Description', 3000),
    is_public: false,
  }
}

/** Learner changes are always private and never write verification columns.
 * Updates are also owner-filtered; database RLS and INSERT/UPDATE triggers enforce this.
 */
export async function savePassportCareerRecord(kind: CareerRecordKind, draft: EducationDraft | ExperienceDraft, id?: string): Promise<PassportRecord> {
  const payload = kind === 'education' ? educationPayload(draft as EducationDraft) : experiencePayload(draft as ExperienceDraft)
  const userId = await owner()
  const table = tables[kind]
  const query = id
    ? supabase.from(table).update(payload).eq('id', id).eq('user_id', userId)
    : supabase.from(table).insert({ ...payload, user_id: userId })
  const { data, error } = await query.select(columns[kind]).single()
  if (error) throw error
  if (!data) throw new Error('Your record was not saved. Please check your connection.')
  return data as unknown as PassportRecord
}
