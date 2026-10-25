import { useId, useState } from 'react'
import { allowedSchoolGrades, educationStageFor } from '../lib/education-profile'

const stageLabels: Record<string, string> = {
  school_1_6: 'Primary school (Grades 1–6)',
  school_7_8: 'Upper primary school (Grades 7–8)',
  school_9_10: 'Secondary school (Grades 9–10)',
  school_11_12: 'Senior secondary school (Grades 11–12)',
}

/**
 * Read-only demonstration of the same 12-grade mapping used by student
 * onboarding. This NEVER writes a grade or bypasses curriculum restrictions.
 */
export default function GradeSelectionPreview() {
  const id = useId()
  const [grade, setGrade] = useState<number | null>(null)
  const stage = educationStageFor('school', grade)
  return (
    <details className="list-panel" aria-label="Try all school grades without changing your profile">
      <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Demo only: Preview Grades 1–12 (does not change your grade)</summary>
      <p className="field-hint">Choose any grade to check how MELA recognizes it. This preview does not save a grade, change an existing student's profile, unlock questions, or enroll anyone.</p>
      <div className="field">
        <label htmlFor={id}>Preview school grade (1–12)</label>
        <select id={id} value={grade ?? ''} onChange={event => {
          const value = event.target.value
          setGrade(value === '' ? null : Number(value))
        }}>
          <option value="">Select a grade to preview</option>
          {allowedSchoolGrades(null).map(n => <option key={n} value={n}>Grade {n}</option>)}
        </select>
      </div>
      {stage && grade !== null && <p role="status"><strong>Grade {grade}</strong> maps to {stageLabels[stage]}. For real curriculum questions, sign in and complete your education profile using your actual grade.</p>}
    </details>
  )
}
