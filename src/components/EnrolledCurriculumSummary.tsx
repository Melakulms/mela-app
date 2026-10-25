import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { educationStageFor } from '../lib/education-profile'
import { eligibleSchoolPrograms, type CurriculumProgram, type CurriculumSubject } from '../lib/curriculum-access'

type Summary =
  | { kind: 'loading' }
  | { kind: 'school'; grade: number; titles: string[]; streams: string[] }
  | { kind: 'higher' }
  | { kind: 'incomplete' }
  | { kind: 'error' }

/** Actual authenticated school curriculum, not the separate 12-grade demo picker. */
export default function EnrolledCurriculumSummary({ onOpenQuestionBank }: { onOpenQuestionBank: () => void }) {
  const [summary, setSummary] = useState<Summary>({ kind: 'loading' })

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) { if (active) setSummary({kind:'incomplete'}); return }
        const { data: profile, error: profileError } = await supabase.from('profiles')
          .select('grade_level,education_stage_key').eq('id', auth.user.id).maybeSingle()
        if (profileError) throw profileError
        if (profile?.education_stage_key === 'university' || profile?.education_stage_key === 'college_tvet') {
          if (active) setSummary({kind:'higher'})
          return
        }
        const grade = profile?.grade_level == null ? null : Number(profile.grade_level)
        const stage = educationStageFor('school', grade)
        if (!stage || stage !== profile?.education_stage_key || grade == null) {
          if (active) setSummary({kind:'incomplete'})
          return
        }
        const { data: learner, error: learnerError } = await supabase.from('student_profiles')
          .select('subjects,academic_track_key').eq('user_id', auth.user.id).maybeSingle()
        if (learnerError) throw learnerError
        const enrolled = Array.isArray(learner?.subjects) ? learner.subjects as string[] : []
        if (!enrolled.length) { if (active) setSummary({kind:'incomplete'}); return }
        const [{data: catalog, error: catalogError},{data: programs,error: programsError}] = await Promise.all([
          supabase.from('mela_national_subject_catalog')
            .select('stage_key,track_key,subject_key,optional').eq('active',true).eq('stage_key',stage),
          supabase.from('mela_learning_programs')
            .select('program_key,subject_key,subject_title,stage_key,grade_level,track_key')
            .eq('active',true).eq('stage_key',stage).eq('grade_level',grade),
        ])
        if (catalogError) throw catalogError
        if (programsError) throw programsError
        const eligible = eligibleSchoolPrograms(
          (programs ?? []) as CurriculumProgram[], (catalog ?? []) as CurriculumSubject[],
          grade, stage, enrolled, learner?.academic_track_key ?? null,
        )
        const titles = [...new Set(eligible.map(p => p.subject_title))].sort((a,b) => a.localeCompare(b))
        const streams = [...new Set(eligible.map(p => p.track_key))]
        if (active) setSummary({kind:'school',grade,titles,streams})
      } catch {
        if (active) setSummary({kind:'error'})
      }
    }
    void load()
    return () => { active = false }
  }, [])

  if (summary.kind === 'higher') return null

  return <section className="list-panel question-card" aria-label="My registered curriculum">
    <h2>My registered curriculum</h2>
    {summary.kind === 'loading' && <p role="status">Checking your saved school grade and subjects…</p>}
    {summary.kind === 'incomplete' && <p role="status">Your real school grade or enrolled subjects are not saved yet. Complete your education profile to access matching questions.</p>}
    {summary.kind === 'error' && <p role="alert">Could not verify your registered subjects. Check your connection and try opening Question Bank for details.</p>}
    {summary.kind === 'school' && <>
      <p role="status"><strong>Grade {summary.grade} · {summary.titles.length} eligible subject{summary.titles.length === 1 ? '' : 's'}</strong></p>
      {summary.streams.length > 0 && summary.grade >= 11 && <p>Enrolled stream: {summary.streams.map(s => s.replaceAll('_',' ')).join(', ')}</p>}
      {summary.titles.length ? <div aria-label="My grade subjects" style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
        {summary.titles.map(title => <span key={title} className="badge">{title}</span>)}
      </div> : <p role="status">No eligible subjects are available for your saved curriculum. Check your education profile.</p>}
      <p className="field-hint">These are the subjects for your actual saved grade, not the Grades 1–12 preview below. Question access is still checked by the server.</p>
    </>}
    <button className="btn btn-primary" type="button" onClick={onOpenQuestionBank}>
      Open my grade's Question Bank
    </button>
  </section>
}
