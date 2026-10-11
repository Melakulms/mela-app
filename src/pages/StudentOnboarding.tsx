import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  educationChoiceFromStage, educationStageFor, effectiveSchoolTrack,
  validateSubjectSelection, type EducationChoice, type ProfileSubject,
} from '../lib/education-profile'

const INTERESTS = ['Mathematics', 'Science', 'Reading & languages', 'Technology & AI', 'Arts & design', 'Agriculture & environment', 'Business & entrepreneurship'] as const
const GOALS = ['Improve my school results', 'Prepare for exams', 'Develop digital skills', 'Explore a career', 'Prepare for scholarships'] as const

type Props = {
  onComplete: () => void
  initialGrade?: number | null
  initialStage?: string | null
  editMode?: boolean
  onCancel?: () => void
}

export default function StudentOnboarding({
  onComplete, initialGrade = null, initialStage = null, editMode = false, onCancel,
}: Props) {
  const [choice, setChoice] = useState<EducationChoice>(() => educationChoiceFromStage(initialStage))
  const [grade, setGrade] = useState<number | null>(initialGrade)
  const [track, setTrack] = useState('natural_sciences')
  const [subjects, setSubjects] = useState<ProfileSubject[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [school, setSchool] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [goals, setGoals] = useState<string[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const stageKey = useMemo(() => educationStageFor(choice, grade), [choice, grade])
  const trackKey = effectiveSchoolTrack(grade, track)
  const isSchool = choice === 'school'
  const priorStageLocked = Boolean(initialStage)
  const requiredSubjects = subjects.filter(subject => !subject.optional)
  const selectionError = validateSubjectSelection(subjects, selected)

  useEffect(() => {
    let active = true
    setError('')
    setCatalogError('')
    setSubjects([])
    setSelected([])
    if (!stageKey) { setLoadingCatalog(false); return () => { active = false } }
    setLoadingCatalog(true)

    const load = async () => {
      try {
        const rows: ProfileSubject[] = isSchool
          ? await Promise.resolve(
            supabase.from('mela_national_subject_catalog')
              .select('subject_key, subject_title, optional')
              .eq('active', true)
              .eq('stage_key', stageKey)
              .eq('track_key', trackKey)
              .order('display_order')
          ).then(({data, error}) => {
            if (error) throw error
            return (data ?? []) as ProfileSubject[]
          })
          : await Promise.resolve(
            supabase.from('mela_learning_programs')
              .select('program_key, subject_title')
              .eq('active', true)
              .eq('stage_key', stageKey)
              .order('subject_title')
          ).then(({data, error}) => {
            if (error) throw error
            return (data ?? []).map(item => ({
              subject_key: item.program_key as string,
              subject_title: item.subject_title as string,
              optional: true,
            }))
          })
        if (!active) return

        const uniqueRows = rows.filter((subject, index) =>
          subject.subject_key && rows.findIndex(other => other.subject_key === subject.subject_key) === index
        )
        let storedSubjects: string[] = []
        if (initialStage) {
          const {data: auth} = await supabase.auth.getUser()
          if (auth.user) {
            const {data, error: readError} = await supabase.from('student_profiles')
              .select('subjects, school_name, learning_interests, goals').eq('user_id', auth.user.id).maybeSingle()
            if (readError) throw readError
            if (!active) return
            storedSubjects = Array.isArray(data?.subjects) ? data.subjects : []
            setSchool(data?.school_name ?? '')
            setInterests((data?.learning_interests ?? []).filter((value: string) => INTERESTS.includes(value as typeof INTERESTS[number])))
            setGoals((data?.goals ?? []).filter((value: string) => GOALS.includes(value as typeof GOALS[number])))
          }
        }
        if (!active) return
        setSubjects(uniqueRows)
        const saved = storedSubjects.filter(key => uniqueRows.some(subject => subject.subject_key === key))
        const required = uniqueRows.filter(subject => !subject.optional).map(subject => subject.subject_key)
        setSelected([...new Set([...required, ...saved])])
      } catch (cause) {
        if (active) setCatalogError(cause instanceof Error ? cause.message : 'Could not load curriculum subjects.')
      } finally {
        if (active) setLoadingCatalog(false)
      }
    }
    void load()
    return () => { active = false }
  }, [stageKey, trackKey, isSchool, initialStage])

  const changeEducation = (value: EducationChoice) => {
    setChoice(value)
    setGrade(null)
    setTrack('natural_sciences')
    setSchool('')
    setError('')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loadingCatalog) return setError('Subjects are loading. Please try again when the list appears.')
    if (!stageKey) return setError('Choose your education level and a school grade where required.')
    if (catalogError) return setError('Could not verify your subjects. Reload the page and try again.')
    if (selectionError) return setError(selectionError)
    setBusy(true)
    setError('')

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Sign in to save your profile.')

      // Save subject selection FIRST. Never mark onboarding complete when it fails.
      const { error: studentError } = await supabase.from('student_profiles')
        .upsert({
          user_id: auth.user.id,
          school_name: school.trim() || null,
          subjects: selected,
          learning_interests: interests,
          goals,
        }, { onConflict: 'user_id' })
      if (studentError) throw studentError

      const { error: profileError } = await supabase.from('profiles')
        .update({
          education_stage_key: stageKey,
          grade_level: isSchool ? grade : null,
          institution_name: school.trim() || null,
          education_onboarding_completed: true,
          onboarding_step: 'completed',
        })
        .eq('id', auth.user.id)
      if (profileError) throw profileError

      onComplete()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your education profile.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-shell">
    <div className="auth-card" style={{maxWidth:720}}>
      <span className="auth-wordmark">MELA</span>
      <h1>{editMode ? 'Your education profile' : 'Complete your education profile'}</h1>
      <p className="auth-subtitle">Required: education level, school grade where applicable, and your curriculum subjects. MELA uses these to organize lessons, practice questions and appropriate competitions.</p>
      <p className="field-hint">School children do not need to provide a date of birth, home address, phone number, or a photo to choose their school curriculum.</p>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      <form onSubmit={e => void save(e)}>
        <div className="field">
          <label htmlFor="education-choice">Education level (required)</label>
          <select id="education-choice" value={choice} required disabled={busy || priorStageLocked}
            onChange={event => changeEducation(event.target.value as EducationChoice)}>
            <option value="" disabled>Select your education level</option>
            <option value="school">Primary or secondary school (Grades 1–12)</option>
            <option value="college_tvet">College or TVET</option>
            <option value="university">University</option>
          </select>
          {priorStageLocked && <p className="field-hint">Changing an established education level needs a verified correction by MELA support to protect grade-based competitions and child safety.</p>}
        </div>
        {isSchool && <div className="field">
          <label htmlFor="grade">School grade (required)</label>
          <select id="grade" required value={grade ?? ''} disabled={busy || priorStageLocked}
            onChange={event => {
              const nextGrade = Number(event.target.value)
              setGrade(nextGrade)
              setTrack(nextGrade >= 11 ? 'natural_sciences' : 'common')
            }}>
            <option value="" disabled>Select your actual grade</option>
            {Array.from({length:12}, (_,index)=>index+1).map(value =>
              <option key={value} value={value}>Grade {value}</option>
            )}
          </select>
        </div>}
        {isSchool && grade !== null && grade >= 11 && <div className="field">
          <label htmlFor="school-track">Grade 11–12 academic stream</label>
          <select id="school-track" value={trackKey} disabled={busy}
            onChange={event => setTrack(event.target.value)}>
            <option value="natural_sciences">Natural Sciences</option>
            <option value="social_sciences">Social Sciences</option>
          </select>
        </div>}
        {stageKey && <div className="field">
          <label htmlFor="school">School or institution (optional)</label>
          <input id="school" maxLength={160} value={school} onChange={event => setSchool(event.target.value)}
            disabled={busy} placeholder="Your school, college or university"/>
          <p className="field-hint">Do not enter your street address. School verification and classroom linking are separate.</p>
        </div>}
        {stageKey && <div className="field">
          <label id="subject-heading">{isSchool ? 'Curriculum subjects' : 'Study programs'} (required)</label>
          {loadingCatalog && <p role="status">Loading verified subjects for your education level…</p>}
          {catalogError && <p className="banner banner-error" role="alert">{catalogError}</p>}
          {!loadingCatalog && !catalogError && subjects.length === 0 &&
            <p className="banner banner-error" role="alert">No verified subjects or programs are available for this education stage yet. Contact MELA support.</p>}
          {!loadingCatalog && !catalogError && subjects.length > 0 && <>
            <p className="field-hint">{isSchool
              ? 'Mandatory school subjects are selected automatically and cannot be removed. Select any additional subjects you study.'
              : 'Choose at least one study program. Only programs from the MELA catalog are shown.'}</p>
            <div className="role-grid" role="group" aria-labelledby="subject-heading">
              {subjects.map(subject => {
                const isSelected = selected.includes(subject.subject_key)
                return <button key={subject.subject_key} type="button"
                  className="role-option" aria-pressed={isSelected}
                  disabled={busy || !subject.optional}
                  onClick={() => setSelected(previous => isSelected
                    ? previous.filter(key => key !== subject.subject_key)
                    : [...previous, subject.subject_key])}>
                  {isSelected ? '✓ ' : ''}{subject.subject_title}
                  {!subject.optional ? ' (required)' : ''}
                </button>
              })}
            </div>
            <p role="status">{selected.length} selected · {requiredSubjects.length} mandatory</p>
          </>}
        </div>}
        {stageKey && <section className="field" aria-label="Optional learning personalization">
          <h2>Personalize your learning (optional)</h2>
          <p className="field-hint">Choose interests and learning goals to help MELA recommend useful lessons. You can skip these. Do not enter private information here.</p>
          <div className="field">
            <label id="learning-interests-label">Your interests</label>
            <div className="role-grid" role="group" aria-labelledby="learning-interests-label">
              {INTERESTS.map(value => <button key={value} type="button" className="role-option"
                aria-pressed={interests.includes(value)} disabled={busy}
                onClick={() => setInterests(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])}>
                {interests.includes(value) ? '✓ ' : ''}{value}
              </button>)}
            </div>
          </div>
          <div className="field">
            <label id="learning-goals-label">My learning goals</label>
            <div className="role-grid" role="group" aria-labelledby="learning-goals-label">
              {GOALS.map(value => <button key={value} type="button" className="role-option"
                aria-pressed={goals.includes(value)} disabled={busy}
                onClick={() => setGoals(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value])}>
                {goals.includes(value) ? '✓ ' : ''}{value}
              </button>)}
            </div>
          </div>
        </section>}
        <button type="submit" className="btn btn-primary btn-block"
          disabled={busy || loadingCatalog || !stageKey || !!catalogError || !!selectionError}>
          {busy ? 'Saving education profile…' : editMode ? 'Save my subjects' : 'Complete profile & open MELA'}
        </button>
        {onCancel && <button type="button" className="btn btn-secondary btn-block"
          disabled={busy} onClick={onCancel}>Back to my profile</button>}
      </form>
      <p className="field-hint">Learning access depends on age-appropriate permissions. Profile information does not verify age, authorize work, approve teachers or unlock payments.</p>
    </div>
  </div>
}
