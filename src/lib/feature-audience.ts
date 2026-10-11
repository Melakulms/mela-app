/** Audience rules for navigation only. Database permissions must independently guard every action. */
export type StudentAudience = { stage: string | null; grade: number | null }

export function audienceAllowsStudentModule(moduleKey: string, audience: StudentAudience): boolean {
  // Cash payouts, escrow, and paid work have not been launched.
  if (moduleKey === 'wallet' || moduleKey === 'earn_work') return false
  // Formal skill verification is intended for upper secondary and tertiary learners.
  if (moduleKey === 'assessments' && audience.stage?.startsWith('school_')) {
    return audience.grade !== null && audience.grade >= 11
  }
  return true
}

export function audienceAllowsStudentView(view: string, audience: StudentAudience): boolean {
  const mapping: Record<string, string> = {
    wallet: 'wallet',
    'earn-work': 'earn_work',
    assessments: 'assessments',
  }
  return audienceAllowsStudentModule(mapping[view] ?? view, audience)
}
