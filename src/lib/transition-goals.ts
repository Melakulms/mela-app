// Mirrors the stage restrictions in private.set_my_mela_next_goal.
// The server remains authoritative, including adult-work eligibility checks.
const labels = {
  next_grade: 'Next grade', college_tvet: 'College or TVET', university: 'University',
  career_path: 'Career pathway', scholarship: 'Scholarship', employment: 'Employment',
  entrepreneurship: 'Entrepreneurship',
} as const
type GoalType = keyof typeof labels
export function goalOptionsForStage(stage: string | null | undefined) {
  let types: GoalType[] = []
  if (stage === 'school_1_6' || stage === 'school_7_8') types = ['next_grade']
  else if (stage === 'school_9_10') types = ['next_grade', 'college_tvet', 'university', 'career_path']
  else if (stage === 'school_11_12') types = ['college_tvet', 'university', 'career_path', 'scholarship', 'employment', 'entrepreneurship']
  else if (stage === 'college_tvet' || stage === 'university') types = ['career_path', 'scholarship', 'employment', 'entrepreneurship', 'university', 'college_tvet']
  return types.map(value => ({ value, label: labels[value] }))
}
