import { educationStageFor } from './education-profile'

export type CurriculumProgram = {
  program_key: string
  subject_key: string
  subject_title: string
  grade_level: number | null
  stage_key: string
  track_key: string
}

export type CurriculumSubject = {
  subject_key: string
  stage_key: string
  track_key: string
  optional: boolean
}

/**
 * Grade and subject choices are read from the authenticated student's saved
 * profile. This controls presentation; RPC authorization must still verify
 * the grade and other entitlements server-side.
 */
export function eligibleSchoolPrograms(
  programs: CurriculumProgram[],
  subjects: CurriculumSubject[],
  grade: number | null,
  stage: string | null,
  enrolledSubjects: string[],
): CurriculumProgram[] {
  const validStage = educationStageFor('school', grade)
  if (!validStage || stage !== validStage || !Array.isArray(enrolledSubjects) || !enrolledSubjects.length) return []
  const enrolled = new Set(enrolledSubjects.filter(s => typeof s === 'string'))
  const relevantCatalog = subjects.filter(s => s.stage_key === validStage)
  const tracks = new Set<string>()
  for (const track of new Set(relevantCatalog.map(s => s.track_key))) {
    if (grade! < 11 && track !== 'common') continue
    // A senior school stream is available only when ALL required subjects
    // of that stream are enrolled, not because one subject overlaps.
    const rows = relevantCatalog.filter(s => s.track_key === track)
    if (rows.length > 0 && rows.filter(s => !s.optional).every(s => enrolled.has(s.subject_key))) tracks.add(track)
  }
  return programs.filter(p =>
    p.stage_key === validStage && p.grade_level === grade &&
    tracks.has(p.track_key) && enrolled.has(p.subject_key) &&
    relevantCatalog.some(s => s.track_key === p.track_key && s.subject_key === p.subject_key)
  )
}
