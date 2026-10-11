import { useEffect, useState } from 'react'
import type { MelaProfile } from '../lib/auth'
import {
  EMPTY_DISCOVERY_PROFILE,
  fetchGradePrograms,
  fetchLearnerDiscoveryProfile,
  saveLearnerDiscoveryProfile,
  type GradeProgram,
  type DegreeGoal,
  type LearnerDiscoveryProfile,
} from '../lib/learner-discovery'

const list = (raw: string) => [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))]
const join = (values: string[]) => values.join(', ')

export default function LearnerDiscoveryEditor({ profile, onSaved }: { profile: MelaProfile; onSaved?: () => void }) {
  const [preferences, setPreferences] = useState<LearnerDiscoveryProfile>(EMPTY_DISCOVERY_PROFILE)
  const [programs, setPrograms] = useState<GradeProgram[]>([])
  const [track, setTrack] = useState('natural_sciences')
  const [interests, setInterests] = useState('')
  const [countries, setCountries] = useState('')
  const [loading, setLoading] = useState(true)
  const [programLoading, setProgramLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const grade = profile.grade_level
  const isSchool = !!profile.education_stage_key?.startsWith('school_') && grade !== null

  useEffect(() => {
    let active = true
    setLoading(true); setError('')
    fetchLearnerDiscoveryProfile().then(value => {
      if (!active) return
      setPreferences(value); setInterests(join(value.interest_fields)); setCountries(join(value.preferred_study_countries))
      if (grade !== null && grade >= 11 && value.preferred_program_keys.some(key => key.includes('social_sciences'))) {
        setTrack('social_sciences')
      }
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load preferences. The database update may still be pending.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [profile.id, grade])

  useEffect(() => {
    let active = true
    if (!isSchool || grade === null) { setPrograms([]); return }
    setProgramLoading(true)
    fetchGradePrograms(grade, track).then(value => {
      if (active) setPrograms(value)
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load grade subjects.')
    }).finally(() => { if (active) setProgramLoading(false) })
    return () => { active = false }
  }, [grade, isSchool, track])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(''); setNotice('')
    const next = {
      ...preferences,
      interest_fields: list(interests),
      preferred_study_countries: list(countries),
      preferred_program_keys: isSchool
        ? preferences.preferred_program_keys.filter(key => programs.some(program => program.program_key === key))
        : [],
    }
    if (next.interest_fields.length > 15 || next.preferred_study_countries.length > 10) {
      setError('Choose up to 15 interests and 10 countries.'); return
    }
    setSaving(true)
    try {
      await saveLearnerDiscoveryProfile(next)
      setPreferences(next)
      setNotice('Your learning and discovery profile was saved. New suggestions will use these preferences.')
      onSaved?.()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save profile.') }
    finally { setSaving(false) }
  }

  return <section className="list-panel learner-discovery-editor" aria-label="Learning and discovery profile">
    <h2>My learning & opportunity preferences</h2>
    <p>Submit your interests to personalize subjects, courses, scholarships and opportunities. These details are private and optional.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {notice && <div className="banner banner-info" role="status">{notice}</div>}
    {loading && <p role="status">Loading your discovery profile…</p>}
    <form onSubmit={event => void save(event)}>
      {isSchool && <div>
        <p><strong>Curriculum:</strong> Grade {grade}. Choose grade-specific subjects below. Your grade can be changed separately in the education profile.</p>
        {grade! >= 11 && <div className="field"><label htmlFor="discovery-track">Academic stream</label>
          <select id="discovery-track" value={track} disabled={saving} onChange={e => { setTrack(e.target.value); setPreferences(current => ({ ...current, preferred_program_keys: [] })) }}>
            <option value="natural_sciences">Natural Sciences</option><option value="social_sciences">Social Sciences</option>
          </select>
        </div>}
        <fieldset className="discovery-subjects" disabled={saving || loading || programLoading}>
          <legend>Subjects available for Grade {grade}</legend>
          {programLoading && <p role="status">Loading Grade {grade} subjects…</p>}
          {!programLoading && programs.length === 0 && <p>No grade-specific subject catalog is available yet. Your saved school profile is unchanged.</p>}
          {programs.map(program => <label key={program.program_key}>
            <input type="checkbox" checked={preferences.preferred_program_keys.includes(program.program_key)}
              onChange={event => setPreferences(current => ({
                ...current,
                preferred_program_keys: event.target.checked
                  ? [...current.preferred_program_keys, program.program_key]
                  : current.preferred_program_keys.filter(key => key !== program.program_key),
              }))} />
            {program.subject_title}
          </label>)}
        </fieldset>
      </div>}
      <div className="field"><label htmlFor="discovery-interests">Areas of interest (comma separated)</label>
        <input id="discovery-interests" maxLength={450} value={interests} onChange={e => setInterests(e.target.value)}
          placeholder="Engineering, agriculture, medicine, computer science" disabled={saving || loading}/>
      </div>
      <div className="field"><label htmlFor="discovery-degree">Preferred study level</label>
        <select id="discovery-degree" value={preferences.target_degree_level} disabled={saving || loading}
          onChange={e => setPreferences(current => ({ ...current, target_degree_level: e.target.value as DegreeGoal }))}>
          <option value="any">Not decided</option><option value="high_school">School</option>
          <option value="diploma">Diploma / TVET</option><option value="bachelor">Bachelor's degree</option>
          <option value="master">Master's degree</option><option value="doctorate">Doctorate</option>
        </select>
      </div>
      <div className="field"><label htmlFor="discovery-countries">Preferred study countries (comma separated, optional)</label>
        <input id="discovery-countries" value={countries} onChange={e => setCountries(e.target.value)} maxLength={300}
          placeholder="Ethiopia, Germany, Canada" disabled={saving || loading}/>
      </div>
      <div className="field"><label htmlFor="discovery-goal">Learning and career goal (optional)</label>
        <textarea id="discovery-goal" maxLength={300} rows={3} disabled={saving || loading}
          value={preferences.learning_goal} onChange={e => setPreferences(current => ({ ...current, learning_goal: e.target.value }))}
          placeholder="What would you like to study or become?"/>
      </div>
      <label className="settings-checkbox">
        <input type="checkbox" checked={preferences.enable_suggestions} disabled={saving || loading}
          onChange={e => setPreferences(current => ({ ...current, enable_suggestions: e.target.checked }))}/>
        Use my profile to suggest opportunities and scholarships
      </label>
      <p className="settings-note">Suggestions are not proof of admission or scholarship eligibility. Always verify age, citizenship, academic results, deadlines and all requirements on the official source.</p>
      <button type="submit" className="btn btn-primary" disabled={loading || saving || programLoading}>{saving ? 'Saving profile…' : 'Save my discovery profile'}</button>
    </form>
  </section>
}
