/**
 * Presentation-only workspace catalogue. Never use these labels to authorize an
 * API request: Supabase RLS and the relevant verified server RPC must decide.
 */
export type LearnerAppRole =
  | 'student' | 'parent' | 'teacher' | 'mentor'
  | 'company' | 'employer' | 'partner'

export type WorkspaceItem = {
  title: string
  requirement: string
}

export const SHARED_ACCOUNT_FEATURES = [
  'My account and profile',
  'Language and device settings',
  'Privacy and safety',
  'Help and support',
  'Notifications (where enabled)',
  'Sign out and account security',
] as const

const workspace: Record<LearnerAppRole, WorkspaceItem[]> = {
  student: [
    { title: 'Grade and subject learning', requirement: 'Saved education profile and approved curriculum' },
    { title: 'Practice, AI Academy and study materials', requirement: 'Eligible published content' },
    { title: 'Arena and challenges', requirement: 'Age and competition eligibility' },
    { title: 'Career Passport and opportunities', requirement: 'Individual privacy and eligibility rules' },
  ],
  parent: [
    { title: 'Family learning guidance', requirement: 'Personal family account' },
    { title: 'Linked learner progress', requirement: 'Verified guardian relationship' },
    { title: 'Consent and safety', requirement: 'Authorized child relationship' },
  ],
  teacher: [
    { title: 'Educator classrooms', requirement: 'Verified teaching identity' },
    { title: 'Subject- and grade-scoped question review', requirement: 'Approved qualification and assigned questions' },
    { title: 'AI lesson and content review', requirement: 'Authorized teacher review assignments' },
  ],
  mentor: [
    { title: 'Mentorship requests and sessions', requirement: 'Verified, active mentor profile' },
    { title: 'Career guidance', requirement: 'Approved mentorship scope and safeguarding' },
  ],
  company: [
    { title: 'Recruitment and applications', requirement: 'Approved employer verification' },
    { title: 'Job and internship listings', requirement: 'Approved organization and opportunity moderation' },
  ],
  employer: [
    { title: 'Recruitment and applications', requirement: 'Legacy employer account review before access' },
    { title: 'Job and internship listings', requirement: 'Approved organization and opportunity moderation' },
  ],
  partner: [
    { title: 'Institutional programs and scholarships', requirement: 'Approved partner organization and program permissions' },
    { title: 'Partner reports', requirement: 'Own institution and authorized programs only' },
  ],
}

export function workspaceItems(role: string): readonly WorkspaceItem[] {
  return Object.hasOwn(workspace, role) ? workspace[role as LearnerAppRole] : []
}

export function isLearnerAppRole(role: string): role is LearnerAppRole {
  return Object.hasOwn(workspace, role)
}
