import JoinClassroom from '../components/JoinClassroom'
import GradeSelectionPreview from '../components/GradeSelectionPreview'
import StudentOnboarding from './StudentOnboarding'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import { fetchEnabledLanguages, type PlatformLanguage } from '../lib/languages'
import { updatePreferredLanguage, logoutUser, type MelaProfile } from '../lib/auth'
import MembershipAndReferrals from '../components/MembershipAndReferrals'
import { useI18n } from '../i18n'

export default function Profile({ profile, onProfileUpdated }: { profile: MelaProfile; onProfileUpdated: () => void }) {
  const { t } = useI18n()
  const [languages, setLanguages] = useState<PlatformLanguage[]>([])
  const [linkCode, setLinkCode] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingEducation, setEditingEducation] = useState(false)
  const [educationRevision, setEducationRevision] = useState(0)
  const [savedEducation, setSavedEducation] = useState<{subjects:string[];learning_interests:string[];goals:string[];preferred_learning_areas:string[];skills:string[]} | null>(null)
  const [educationReadError, setEducationReadError] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchEnabledLanguages().then(setLanguages).catch(() => {})
  }, [])

  useEffect(() => {
    if (profile.role !== 'student') return
    let active = true
    setEducationReadError('')
    void Promise.resolve(supabase.from('student_profiles')
      .select('subjects,learning_interests,goals,preferred_learning_areas,skills')
      .eq('user_id',profile.id).maybeSingle()).then(({data,error}) => {
        if(!active)return
        if(error) { setEducationReadError('Could not read saved subjects from MELA. Your selections are not confirmed.'); return }
        setSavedEducation(data ? {
          subjects:data.subjects ?? [],learning_interests:data.learning_interests ?? [],
          goals:data.goals ?? [],preferred_learning_areas:data.preferred_learning_areas ?? [],
          skills:data.skills ?? [],
        } : null)
      }).catch(() => {if(active)setEducationReadError('Unable to verify your saved learning profile while offline.')})
    return () => {active=false}
  },[profile.id,profile.role,educationRevision])

  const changeLanguage = async (code: string) => {
    setSaving(true)
    setError('')
    try {
      await updatePreferredLanguage(code)
      onProfileUpdated()
    } catch (e: any) {
      setError(e.message ?? t('languageSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const createParentLink = async () => {
    setLinkBusy(true); setError('')
    try {
      const { data, error } = await supabase.rpc('create_parent_link_invite_v35')
      if (error) throw error
      if (typeof data !== 'string' || !data) throw new Error(t('connectionError'))
      setLinkCode(data)
    } catch (error) { setError(error instanceof Error ? error.message : t('connectionError')) }
    finally { setLinkBusy(false) }
  }

  if (editingEducation) return <StudentOnboarding
    editMode
    initialGrade={profile.grade_level}
    initialStage={profile.education_stage_key}
    onComplete={() => { setEditingEducation(false); setEducationRevision(n => n + 1); onProfileUpdated() }}
    onCancel={() => setEditingEducation(false)}
  />

  return (
    <div className="dash-main">
      <h1>{t('profileHeading')}</h1>
      {error && <div className="banner banner-error">{error}</div>}

      <div className="section-heading"><h2>{t('personalInformation')}</h2></div>
      <div className="list-panel">
        <div className="list-row"><div className="list-row-title">{t('name')}</div><div className="list-row-meta">{profile.full_name}</div></div>
        <div className="list-row"><div className="list-row-title">{t('email')}</div><div className="list-row-meta">{profile.email}</div></div>
        <div className="list-row"><div className="list-row-title">{t('role')}</div><div className="list-row-meta">{profile.role}</div></div>
        <div className="list-row"><div className="list-row-title">{t('coins')}</div><div className="list-row-meta">{profile.coin_balance}</div></div>
      </div>

      {profile.role === 'student' && <section className="list-panel" aria-label="Education profile">
        <h2>My education and subjects</h2>
        <p><strong>Education level:</strong> {profile.education_stage_key === 'university' ? 'University'
          : profile.education_stage_key === 'college_tvet' ? 'College / TVET'
          : profile.grade_level ? `Grade ${profile.grade_level}` : 'Not yet selected'}</p>
        <p>Curriculum subjects, lessons, exercises and question banks are based on your completed education profile.</p>
        {educationReadError && <p role="alert">{educationReadError}</p>}
        {savedEducation ? <>
          <p><strong>Saved subjects:</strong> {savedEducation.subjects.length ? savedEducation.subjects.join(', ') : 'No subjects recorded'}</p>
          <p><strong>Learning interests:</strong> {savedEducation.learning_interests.join(', ') || 'Not selected'}</p>
          <p><strong>Learning goals:</strong> {savedEducation.goals.join(', ') || 'Not selected'}</p>
          <p><strong>Preferred study support:</strong> {savedEducation.preferred_learning_areas.join(', ') || 'Not selected'}</p>
          <p><strong>Skills to build:</strong> {savedEducation.skills.join(', ') || 'Not selected'}</p>
        </> : !educationReadError && <p role="status">Checking your saved subjects…</p>}
        <button type="button" className="btn btn-secondary" onClick={() => setEducationRevision(n => n + 1)}>Refresh saved profile</button> 
        <button type="button" className="btn btn-secondary" onClick={() => setEditingEducation(true)}>
          Manage my education subjects
        </button>
        <p className="field-hint">A school grade or education-stage change needs verified correction by MELA support so competitions and child-safety controls remain accurate.</p>
      </section>}

      {profile.role === 'student' && <MembershipAndReferrals userId={profile.id} />}
      {profile.role === 'student' && <GradeSelectionPreview />}

      <div className="section-heading"><h2>{t('language')}</h2></div>
      <div className="field">
        <select value={profile.preferred_language} onChange={(e) => changeLanguage(e.target.value)} disabled={saving}>
          {languages.map((l) => (
            <option key={l.language_code} value={l.language_name}>{l.native_name}</option>
          ))}
        </select>
      </div>

      {profile.role === 'student' && <JoinClassroom />}
      {profile.role === 'student' && <section>
        <div className="section-heading"><h2>{t('connectParent')}</h2></div>
        <p className="muted">{t('parentLinkHelp')}</p>
        <button className="btn btn-primary" disabled={linkBusy} onClick={createParentLink}>{linkBusy ? t('generating') : t('generateParentLink')}</button>
        {linkCode && <div className="field"><label htmlFor="parent-link-code">{t('parentLinkCode')}</label><input id="parent-link-code" readOnly value={linkCode} onFocus={e => e.target.select()} /></div>}
      </section>}

      <button className="btn btn-secondary btn-block" onClick={() => logoutUser()}>{t('logout')}</button>
    </div>
  )
}
