import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Subject = {
  subject_key: string
  subject_title: string
  optional: boolean
}

export default function StudentOnboarding({ onComplete }: { onComplete: () => void }) {
  const [grade, setGrade] = useState<number>(9)
  const [track, setTrack] = useState('natural_sciences')
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [school, setSchool] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const stageKey = useMemo(() => {
    if (grade <= 6) return 'school_1_6'
    if (grade <= 8) return 'school_7_8'
    if (grade <= 10) return 'school_9_10'
    return 'school_11_12'
  }, [grade])

  useEffect(() => {
    setError('')
    if (grade < 11) setTrack('common')
    else if (track === 'common') setTrack('natural_sciences')
    supabase
      .from('mela_national_subject_catalog')
      .select('subject_key, subject_title, optional')
      .eq('active', true)
      .eq('stage_key', stageKey)
      .eq('track_key', grade >= 11 ? track : 'common')
      .order('display_order')
      .then(({ data, error }) => {
        if (error) { setError(error.message); return }
        const rows = (data ?? []) as Subject[]
        setSubjects(rows)
        setSelected(rows.filter(s => !s.optional).map(s => s.subject_key))
      })
  }, [stageKey, track, grade])

  const save = async () => {
    if (selected.length === 0) {
      setError('Select at least one subject.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) throw new Error('You are not signed in.')

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          education_stage_key: stageKey,
          grade_level: grade,
          institution_name: school.trim() || null,
          education_onboarding_completed: true,
          onboarding_step: 'completed',
        })
        .eq('id', auth.user.id)
      if (profileError) throw profileError

      const { error: studentError } = await supabase
        .from('student_profiles')
        .upsert({
          user_id: auth.user.id,
          school_name: school.trim() || null,
          subjects: selected,
        }, { onConflict: 'user_id' })
      if (studentError) throw studentError

      onComplete()
    } catch (e: any) {
      setError(e.message ?? 'Could not save your education setup.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card" style={{ maxWidth: 720 }}>
        <span className="auth-wordmark">MELA</span>
        <h1>Set up your learning profile</h1>
        <p className="auth-subtitle">Choose your grade and subjects so MELA can show the correct Ethiopian curriculum and question bank for Grades 1–12.</p>

        {error && <div className="banner banner-error">{error}</div>}

        <div className="field">
          <label htmlFor="grade">Grade</label>
          <select id="grade" value={grade} onChange={e => setGrade(Number(e.target.value))} disabled={busy}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Grade {g}</option>)}
          </select>
        </div>

        {grade >= 11 && (
          <div className="field">
            <label htmlFor="track">Track</label>
            <select id="track" value={track} onChange={e => setTrack(e.target.value)} disabled={busy}>
              <option value="natural_sciences">Natural Sciences</option>
              <option value="social_sciences">Social Sciences</option>
            </select>
          </div>
        )}

        <div className="field">
          <label htmlFor="school">School (optional)</label>
          <input id="school" value={school} onChange={e => setSchool(e.target.value)} disabled={busy} placeholder="Your school name" />
        </div>

        <div className="field">
          <label>Subjects</label>
          <div className="role-grid">
            {subjects.map(s => (
              <button
                key={s.subject_key}
                type="button"
                className="role-option"
                aria-pressed={selected.includes(s.subject_key)}
                onClick={() => setSelected(current => current.includes(s.subject_key)
                  ? current.filter(x => x !== s.subject_key)
                  : [...current, s.subject_key])}
                disabled={busy}
              >
                {s.subject_title}{s.optional ? ' (optional)' : ''}
              </button>
            ))}
          </div>
        </div>

        <button className="btn btn-primary btn-block" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Continue to MELA'}
        </button>
      </div>
    </div>
  )
}
