import { supabase } from './supabase'

export const INFORMATION_VERSION = '2026-11-01-v1'
export type InformationField = { key: string; label: string; required?: boolean; options?: string[]; multiline?: boolean; max?: number }
const organizationFields: InformationField[] = [
  { key: 'organization_type', label: 'Organization type', required: true, options: ['Business', 'School or university', 'Nonprofit', 'Government', 'Independent professional', 'Other organization'] },
  { key: 'representative_title', label: 'Your role or job title', required: true },
  { key: 'operating_location', label: 'Operating city / region', required: true },
  { key: 'partnership_purpose', label: 'What your organization offers', required: true, options: ['Jobs and internships', 'Scholarships', 'Training', 'Sponsorship', 'Multiple opportunities'] },
]
export const ROLE_INFORMATION: Record<string, InformationField[]> = {
  student: [{ key: 'learning_goal', label: 'Your main learning goal', required: true, options: ['Improve school results', 'Prepare for exams', 'Build practical skills', 'Explore careers', 'Prepare for scholarships'] }],
  parent: [{ key: 'guardian_relationship', label: 'Your relationship to the learner', required: true, options: ['Parent', 'Legal guardian', 'Other family member'] }],
  teacher: [{ key: 'teaching_languages', label: 'Languages you teach in', required: true }],
  company: organizationFields,
  employer: organizationFields,
  partner: [
    { key: 'organization_name', label: 'Organization name', required: true },
    { key: 'industry', label: 'Industry / sector', required: true },
    ...organizationFields,
    { key: 'organization_description', label: 'About your organization', required: true, multiline: true, max: 1500 },
  ],
  mentor: [
    { key: 'professional_title', label: 'Professional title', required: true },
    { key: 'expertise', label: 'Expertise and mentorship categories', required: true },
    { key: 'qualification', label: 'Relevant qualifications', required: true },
    { key: 'experience', label: 'Relevant professional experience', required: true, multiline: true, max: 1500 },
    { key: 'languages', label: 'Languages you can mentor in', required: true },
    { key: 'learner_groups', label: 'Learners you want to support', required: true, options: ['Adults only', 'School learners with safeguarding approval', 'Both, subject to safeguarding approval'] },
    { key: 'biography', label: 'Professional introduction', required: true, multiline: true, max: 1500 },
    { key: 'availability', label: 'Usual available days and times', required: true },
    { key: 'timezone', label: 'Timezone', required: true, options: ['Africa/Addis_Ababa', 'UTC', 'Other — confirm with MELA before booking'] },
    { key: 'session_format', label: 'Session format', required: true, options: ['Online', 'In person through an approved program', 'Both'] },
    { key: 'conduct_agreement', label: 'I will follow safeguarding rules, keep communications appropriate, and report safety concerns through MELA.', required: true, options: ['Yes'] },
  ],
}

export function informationFields(role: string): InformationField[] {
  if (!Object.prototype.hasOwnProperty.call(ROLE_INFORMATION, role)) return []
  return [
    { key: 'age_group', label: 'Age group (self-reported)', required: true, options: role === 'student' ? ['Under 13', '13–17', '18 or older'] : ['18 or older'] },
    { key: 'preferred_language', label: 'Preferred language', required: true, options: ['English', 'Amharic', 'Afaan Oromo', 'Tigrinya', 'Somali'] },
    ...ROLE_INFORMATION[role],
    { key: 'display_name', label: 'Public display name (optional)', max: 100 },
    { key: 'accessibility', label: 'Learning or accessibility support you prefer (optional; no medical details)', max: 500 },
    { key: 'notice_acknowledged', label: 'I have read the information-use notice below and will provide accurate information and use MELA respectfully.', required: true, options: ['Yes'] },
  ]
}

export function informationErrors(role: string, details: Record<string, string>): string[] {
  const fields = informationFields(role)
  if (!fields.length) return ['This account type needs MELA support.']
  const errors: string[] = []
  for (const field of fields) {
    const value = (details[field.key] ?? '').trim()
    if (field.required && !value) errors.push(`${field.label} is required.`)
    else if (value && field.options && !field.options.includes(value)) errors.push(`Choose a valid option for ${field.label}.`)
    else if (value.length > (field.max ?? 250)) errors.push(`${field.label} is too long.`)
  }
  return errors
}

export type UserInformation = { user_id: string; role: string; details: Record<string, string>; completed: boolean; notice_version: string }
export async function loadUserInformation(userId: string): Promise<UserInformation | null> {
  const {data, error} = await supabase.from('user_information').select('user_id,role,details,completed,notice_version').eq('user_id', userId).maybeSingle()
  if (error) throw new Error('Your saved information could not be loaded. Check your connection and try again.')
  return data as UserInformation | null
}
export async function saveUserInformation(userId: string, role: string, details: Record<string, string>, complete: boolean): Promise<void> {
  const cleaned = Object.fromEntries(informationFields(role).map(field => [field.key, (details[field.key] ?? '').trim()]))
  if (complete) {
    const errors = informationErrors(role, cleaned)
    if (errors.length) throw new Error(errors.join(' '))
  }
  const {data,error} = await supabase.from('user_information').upsert({user_id:userId,role,details:cleaned,completed:complete,notice_version:INFORMATION_VERSION}, {onConflict:'user_id'})
    .select('user_id,completed').single()
  if(error || !data || data.user_id !== userId || data.completed !== complete) throw new Error('Your information was not saved. Your entries remain on this screen; check your connection and try again.')
}
