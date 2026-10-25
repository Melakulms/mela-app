import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveMyEducationProfile } from '../lib/education-profile-save'
import {
  educationChoiceFromStage, educationStageFor, effectiveSchoolTrack,
  validateSubjectSelection, allowedSchoolGrades, canChooseSchoolGrade, type EducationChoice, type ProfileSubject,
} from '../lib/education-profile'

const INTERESTS = ['Mathematics', 'Science', 'Reading & languages', 'Technology & AI', 'Arts & design', 'Agriculture & environment', 'Business & entrepreneurship'] as const
const GOALS = ['Improve my school results', 'Prepare for exams', 'Develop digital skills', 'Explore a career', 'Prepare for scholarships'] as const
const PREFERRED_AREAS = ['Step-by-step explanations', 'Extra practice questions', 'Exam preparation', 'AI foundations', 'Career and scholarship guidance'] as const
const SKILLS = ['Reading and writing', 'Problem solving', 'Research', 'Computer skills', 'Communication', 'Creative projects'] as const

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
  const [track, setTrack] = useState('')
  const [savedTrackLocked, setSavedTrackLocked] = useState(false)
  const [subjects, setSubjects] = useState<ProfileSubject[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [school, setSchool] = useState('')
  const [interests, setInterests] = useState<string[]>([])
  const [goals, setGoals] = useState<string[]>([])
  const [preferredAreas, setPreferredAreas] = useState<string[]>([])
  const [skills, setSkills] = useState<string[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const stageKey = useMemo(() => educationStageFor(choice, grade), [choice, grade])
  const trackKey = effectiveSchoolTrack(grade, track)
  const isSchool = choice === 'school'
  const priorStageLocked = Boolean(initialStage)
  const permittedGrades = allowedSchoolGrades(initialStage)
  const requiredSubjects = subjects.filter(subject => !subject.optional)
  const selectionError = isSchool && grade !== null && grade >= 11 && !trackKey
    ? 'Choose your academic stream before selecting subjects.'
    : validateSubjectSelection(subjects, selected)

  useEffect(() => {
    let active = true
    setError('')
    setCatalogError('')
    setSubjects([])
    setSelected([])
    if (!stageKey || (isSchool && grade !== null && grade >= 11 && !trackKey)) { setLoadingCatalog(false); return () => { active = false } }
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
        // Some live deployments have per-grade learning programs but no stage-wide
        // subject catalog rows. Use those programs as a grounded second source.
        if (!isSchool && grade !== null) {
          const {data: gradePrograms, error: programsError} = await supabase.from('mela_learning_programs')
            .select('program_key,subject_title,grade_level,track_key')
            .eq('active', true).eq('stage_key', stageKey).eq('grade_level', grade)
            .in('track_key', grade >= 11 ? ['common',trackKey] : ['common'])
            .order('subject_title')
          if (programsError && rows.length === 0) throw programsError
          for (const program of gradePrograms ?? []) {
            if (!rows.some(subject => subject.subject_title.trim().toLowerCase() === program.subject_title.trim().toLowerCase())) {
              rows.push({subject_key: program.program_key, subject_title: program.subject_title, optional: true})
            }
          }
        }
        if (!active) return

        const uniqueRows = rows.filter((subject, index) =>
          subject.subject_key && rows.findIndex(other => other.subject_key === subject.subject_key) === index
        )
        let storedSubjects: string[] = []
        if (initialStage) {
          const {data: auth} = await supabase.auth.getUser()
          if (auth.user) {
            const {data, error: readError} = await supabase.from('student_profiles')
              .select('subjects, school_name, learning_interests, goals, preferred_learning_areas, skills').eq('user_id', auth.user.id).maybeSingle()
            if (readError) throw readError
            if (!active) return
            storedSubjects = Array.isArray(data?.subjects) ? data.subjects : []
            setSchool(data?.school_name ?? '')
            setInterests((data?.learning_interests ?? []).filter((value: string) => INTERESTS.includes(value as typeof INTERESTS[number])))
            setGoals((data?.goals ?? []).filter((value: string) => GOALS.includes(value as typeof GOALS[number])))
            setPreferredAreas((data?.preferred_learning_areas ?? []).filter((value: string) => PREFERRED_AREAS.includes(value as typeof PREFERRED_AREAS[number])))
            setSkills((data?.skills ?? []).filter((value: string) => SKILLS.includes(value as typeof SKILLS[number])))
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
    setTrack('')
    setSchool('')
    setError('')
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    if (loadingCatalog) return setError('Subjects are loading. Please try again when the list appears.')
    if (!stageKey) return setError('Choose your education level and a school grade where required.')
    if (catalogError) return setError('Could not verify your subjects. Reload the page and try again.')
    if (selectionError) return setError(selectionError)
    if (isSchool && grade !== null && grade >= 11 && !trackKey) return setError('Select a registered academic stream first.')
    setBusy(true)
    setError('')

    try {
      await saveMyEducationProfile({
        stageKey,
        grade: isSchool ? grade : null,
        trackKey: isSchool && grade !== null && grade >= 11 ? trackKey : null,
        school,
        subjects: selected,
        interests,
        goals,
        preferredAreas,
        skills,
      })
      onComplete()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The server failed to save your education profile.'
      setError(message + ' Your choices are still on this screen. Copy this message for support if the problem continues.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-shell">
    <div className="auth-card" style={{maxWidth:720}}>
      <span className="auth-wordmark">MELA</span>
      <h1>{editMode ? 'Your education profile' : 'Complete your education profile'}</h1>
      <p className="auth-subtitle">Required registration setup: choose your education level, your actual school grade (if in Grades 1–12), and your curriculum subjects. MELA saves your grade and automatically restricts Practice and Question Bank to that grade.</p>
      <p className="field-hint">School children do not need to provide a date of birth, home address, phone number, or a photo to choose their school curriculum.</p>
      {error && <div className="banner banner-error" role="alert">
        <p>{error}</p>
        <button type="button" className="btn btn-secondary" onClick={() => void navigator.clipboard?.writeText(error).catch(() => {})}>Copy error for support</button>
      </div>}
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
          {priorStageLocked && <p className="field-hint">Your education stage is already saved. You may select a grade only if your grade has not been saved before. Any correction or promotion of an existing grade requires verified MELA support.</p>}
        </div>
        {isSchool && <div className="field">
          <label htmlFor="grade">School grade (required — Grades 1–12)</label>
          <select id="grade" required value={grade ?? ''} disabled={busy || !canChooseSchoolGrade(editMode, initialGrade !== null)}
            onChange={event => {
              const nextGrade = Number(event.target.value)
              setGrade(nextGrade)
              setTrack(nextGrade >= 11 ? '' : 'common')
            }}>
            <option value="" disabled>Choose your actual grade (no default)</option>
            {permittedGrades.map(value =>
              <option key={value} value={value}>Grade {value}</option>
            )}
          </select>
          {priorStageLocked && initialGrade === null && !editMode && <p className="field-hint">Select your actual grade once to finish registration setup. MELA will save it for your practice questions.</p>}
          {initialGrade !== null && <p className="field-hint">Grade {initialGrade} is already saved. Only verified MELA support can authorize a promotion or grade correction. Practice cannot change your grade.</p>}
          {priorStageLocked && editMode && initialGrade === null && <p className="field-hint">A saved grade will be locked for learner safety and curriculum accuracy.</p>}
        </div>}
        {isSchool && grade !== null && grade >= 11 && <div className="field">
          <label htmlFor="school-track">Grade 11–12 academic stream</label>
          <select id="school-track" value={trackKey} required disabled={busy || savedTrackLocked}
            onChange={event => setTrack(event.target.value)}>
            <option value="" disabled>Choose your academic stream</option>
            <option value="natural_sciences">Natural Sciences</option>
            <option value="social_sciences">Social Sciences</option>
          </select>
          {savedTrackLocked && <p className="field-hint">Saved academic stream is locked. Request verified MELA support to correct it.</p>}
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
          {!loadingCatalog && !catalogError && subjects.length === 0 && !(isSchool && grade !== null && grade >= 11 && !trackKey) &&
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
          <div className="field">
            <label id="learning-areas-label">How I learn best</label>
            <div className="role-grid" role="group" aria-labelledby="learning-areas-label">
              {PREFERRED_AREAS.map(value => <button key={value} type="button" className="role-option"
                aria-pressed={preferredAreas.includes(value)} disabled={busy}
                onClick={() => setPreferredAreas(current => current.includes(value) ? current.filter(item => item !== value) : [...current,value])}>
                {preferredAreas.includes(value) ? '✓ ' : ''}{value}
              </button>)}
            </div>
          </div>
          <div className="field">
            <label id="learning-skills-label">Skills I want to build</label>
            <div className="role-grid" role="group" aria-labelledby="learning-skills-label">
              {SKILLS.map(value => <button key={value} type="button" className="role-option"
                aria-pressed={skills.includes(value)} disabled={busy}
                onClick={() => setSkills(current => current.includes(value) ? current.filter(item => item !== value) : [...current,value])}>
                {skills.includes(value) ? '✓ ' : ''}{value}
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
