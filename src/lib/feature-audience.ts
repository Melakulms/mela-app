/** Audience rules for navigation only. Database permissions must independently guard every action. */
export type StudentAudience = { stage: string | null; grade: number | null }

export function audienceAllowsStudentModule(moduleKey: string, audience: StudentAudience): boolean {
  // Cash payouts, escrow, and paid work have not been launched.
  if (moduleKey === 'wallet' || moduleKey === 'earn_work') return false
  // School question curricula have no equivalent stage-matched catalogue for TVET/university users.
  if (moduleKey === 'question_bank') return !!audience.stage?.startsWith('school_') && audience.grade !== null
  // Career-oriented verification is not a primary grade-school activity.
  if (moduleKey === 'ai_career_coach' && audience.stage?.startsWith('school_') && (audience.grade ?? 0) <= 6) return false
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
    'question-bank': 'question_bank',
    coach: 'ai_career_coach',
  }
  return audienceAllowsStudentModule(mapping[view] ?? view, audience)
}

/** Restrict school learner discovery to educational opportunities. This is a UI filter only. */
export function audienceAllowsOpportunityType(type: string | null | undefined, audience: StudentAudience): boolean {
  if (!audience.stage?.startsWith('school_')) return true
  const typeName = (type ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  return !['job','jobs','employment','full_time','part_time','internship','internships','freelance','gig','paid_work','work','earn_work'].includes(typeName)
}
