/** Scholarship matching must never infer nationality, verified academic qualifications,
 * document authenticity, application submission or university decisions from a
 * generic user profile or a self-completed checklist.
 */
export type ScholarshipAcademicProfile = {
  role: string | null
  full_name: string | null
  education_stage_key: string | null
  education_onboarding_completed: boolean | null
  grade_level: number | null
  major: string | null
  graduation_year: number | null
  email_verified: boolean | null
  phone_verified: boolean | null
}
export type ScholarshipStudyLevel = 'undergraduate' | 'masters' | 'phd' | 'mixed'
export type PreliminaryLevel = 'explore_only' | 'possibly_relevant' | 'more_information_needed'

export function educationReadiness(profile: ScholarshipAcademicProfile | null) {
  const checks = [
    { key: 'account', label: 'Student role and basic identity', complete: Boolean(profile?.role === 'student' && profile?.full_name?.trim()) },
    { key: 'education', label: 'Education profile and current stage', complete: Boolean(profile?.education_onboarding_completed && profile?.education_stage_key) },
    { key: 'field', label: 'Field of study or intended subject', complete: Boolean(profile?.major?.trim()) },
    { key: 'graduation', label: 'Actual or expected graduation year', complete: Boolean(profile?.graduation_year && profile.graduation_year >= 1990 && profile.graduation_year <= 2100) },
    { key: 'contact', label: 'Verified account contact', complete: Boolean(profile?.email_verified || profile?.phone_verified) },
  ]
  const completed = checks.filter(x => x.complete).length
  return { checks, completed, total: checks.length, profileReadyForResearchMatching: completed === checks.length }
}

export function preliminaryScholarshipMatch(
  profile: ScholarshipAcademicProfile | null,
  programmeLevel: ScholarshipStudyLevel,
  verifiedAcademicDocuments: number,
): { level: PreliminaryLevel; label: string; reasons: string[] } {
  const reasons: string[] = []
  if (!profile?.education_onboarding_completed || !profile.education_stage_key || profile.role !== 'student') {
    reasons.push('Complete the student education profile first')
  }
  if (!profile?.major?.trim()) reasons.push('Add your current or intended field of study')
  if (!profile?.graduation_year) reasons.push('Record your graduation or expected completion year')
  // Nationality is not collected in the current general MELA profile: never infer it
  // from country of residence or a programme's advertised international eligibility.
  reasons.push('Nationality, residence and scholarship-specific conditions have not been independently checked')
  reasons.push('Language proficiency or waiver rules have not been verified')
  if (verifiedAcademicDocuments < 1) reasons.push('No academic document has been verified by MELA')
  const stage = profile?.education_stage_key ?? ''
  const grade = profile?.grade_level
  if (stage.startsWith('school_') && grade != null && grade <= 10) {
    return {level:'explore_only',label:'Future study research only — not eligible to apply for a degree yet',reasons}
  }
  if (!profile?.education_onboarding_completed || !stage || !profile.major?.trim() || !profile.graduation_year) {
    return {level:'more_information_needed',label:'More learner information needed for matching',reasons}
  }
  if ((programmeLevel === 'masters' || programmeLevel === 'phd' || programmeLevel === 'mixed') && verifiedAcademicDocuments < 1) {
    reasons.push('Prior degree needed for this study level has not been verified')
    return {level:'more_information_needed',label:'Academic qualifications must be checked first',reasons}
  }
  if (programmeLevel === 'undergraduate' && (stage === 'university' || stage === 'college_tvet' || stage === 'school_11_12')) {
    return {level:'possibly_relevant',label:'Possible study-level fit — NOT verified eligible',reasons}
  }
  return {level:'more_information_needed',label:'Study-level eligibility cannot yet be confirmed',reasons}
}
