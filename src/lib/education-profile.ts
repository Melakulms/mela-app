export type EducationChoice = '' | 'school' | 'college_tvet' | 'university'
export type ProfileSubject = { subject_key: string; subject_title: string; optional: boolean }

export function educationStageFor(choice: EducationChoice, grade: number | null): string | null {
  if (choice === 'college_tvet' || choice === 'university') return choice
  if (choice !== 'school' || !Number.isInteger(grade) || grade === null || grade < 1 || grade > 12) return null
  if (grade <= 6) return 'school_1_6'
  if (grade <= 8) return 'school_7_8'
  if (grade <= 10) return 'school_9_10'
  return 'school_11_12'
}

export function educationChoiceFromStage(stage: string | null | undefined): EducationChoice {
  if (stage === 'college_tvet' || stage === 'university') return stage
  if (stage?.startsWith('school_')) return 'school'
  return ''
}

export function effectiveSchoolTrack(grade: number | null, track: string): string {
  return grade !== null && grade >= 11 ? (track === 'social_sciences' ? 'social_sciences' : 'natural_sciences') : 'common'
}

export function validateSubjectSelection(subjects: ProfileSubject[], selected: string[]): string | null {
  if (subjects.length === 0) return 'No verified subjects or programs are available for this education stage yet. Please contact MELA support.'
  const catalog = new Set(subjects.map(s => s.subject_key))
  if (selected.length === 0) return 'Choose at least one subject or study program.'
  if (selected.some(key => !catalog.has(key))) return 'Subjects changed. Reload your curriculum subjects and choose again.'
  if (subjects.some(s => !s.optional && !selected.includes(s.subject_key))) return 'Required curriculum subjects must remain selected.'
  return null
}

export function isValidSchoolGrade(grade: number | null): boolean {
  return grade !== null && Number.isInteger(grade) && grade >= 1 && grade <= 12
}
