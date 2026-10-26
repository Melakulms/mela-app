import { useRef, useState } from 'react'
import { savePassportCareerRecord, type CareerRecordKind, type EducationDraft, type ExperienceDraft, type PassportRecord } from '../lib/passport-records'

const emptyEducation = (): EducationDraft => ({
  institution: '', qualification: '', field_of_study: '', start_year: '', end_year: '',
  grade: '', is_current: false, description: '',
})
const emptyExperience = (): ExperienceDraft => ({
  organization: '', title: '', experience_type: 'work', start_date: '', end_date: '',
  is_current: false, description: '',
})
export default function PassportCareerEditor({ kind, record, onSaved, onCancel }: {
  kind: CareerRecordKind
  record?: PassportRecord
  onSaved: () => void
  onCancel: () => void
}) {
  const [education, setEducation] = useState<EducationDraft>(() => record ? {
    institution: record.institution ?? '', qualification: record.qualification ?? '',
    field_of_study: record.field_of_study ?? '',
    start_year: String(record.start_year ?? ''), end_year: String(record.end_year ?? ''),
    grade: record.grade ?? '', is_current: record.is_current === true, description: record.description ?? '',
  } : emptyEducation())
  const [experience, setExperience] = useState<ExperienceDraft>(() => record ? {
    organization: record.organization ?? '', title: record.title ?? '',
    experience_type: record.experience_type ?? 'work',
    start_date: record.start_date ?? '', end_date: record.end_date ?? '',
    is_current: record.is_current === true, description: record.description ?? '',
  } : emptyExperience())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  const setEducationValue = <K extends keyof EducationDraft>(key: K, value: EducationDraft[K]) =>
    setEducation(prev => ({ ...prev, [key]: value }))
  const setExperienceValue = <K extends keyof ExperienceDraft>(key: K, value: ExperienceDraft[K]) =>
    setExperience(prev => ({ ...prev, [key]: value }))
  const save = async () => {
    if (lock.current) return
    lock.current = true
    setSaving(true); setError('')
    try {
      await savePassportCareerRecord(kind, kind === 'education' ? education : experience, record?.id)
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save. Your draft is still here.')
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  return <form aria-label={kind === 'education' ? 'Education editor' : 'Experience editor'} onSubmit={e => { e.preventDefault(); void save() }}>
    <h3>{record ? 'Edit' : 'Add'} {kind}</h3>
    <p className="field-hint">This is a private, self-reported record, not a MELA-verified qualification. Verification is restricted to authorized reviewers. Do not enter identity documents, passwords or other people's personal information.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {kind === 'education' ? <>
      <div className="field"><label htmlFor="career-institution">School or institution</label>
        <input id="career-institution" required maxLength={200} disabled={saving} value={education.institution} onChange={e => setEducationValue('institution', e.target.value)}/></div>
      <div className="field"><label htmlFor="career-qualification">Qualification (optional)</label>
        <input id="career-qualification" maxLength={200} disabled={saving} value={education.qualification} onChange={e => setEducationValue('qualification', e.target.value)}/></div>
      <div className="field"><label htmlFor="career-field">Field of study (optional)</label>
        <input id="career-field" maxLength={200} disabled={saving} value={education.field_of_study} onChange={e => setEducationValue('field_of_study', e.target.value)}/></div>
      <div className="field"><label htmlFor="career-grade">Grade or level (optional)</label>
        <input id="career-grade" maxLength={40} disabled={saving} value={education.grade} onChange={e => setEducationValue('grade', e.target.value)}/></div>
      <div className="field"><label htmlFor="career-start-year">Start year (optional)</label>
        <input id="career-start-year" inputMode="numeric" maxLength={4} placeholder="2024" disabled={saving} value={education.start_year} onChange={e => setEducationValue('start_year', e.target.value)}/></div>
      <label><input type="checkbox" disabled={saving} checked={education.is_current} onChange={e => setEducationValue('is_current', e.target.checked)}/> I am still studying here</label>
      {!education.is_current && <div className="field"><label htmlFor="career-end-year">End year (optional)</label>
        <input id="career-end-year" inputMode="numeric" maxLength={4} placeholder="2026" disabled={saving} value={education.end_year} onChange={e => setEducationValue('end_year', e.target.value)}/></div>}
      <div className="field"><label htmlFor="career-education-description">What I studied (optional)</label>
        <textarea id="career-education-description" maxLength={3000} disabled={saving} value={education.description} onChange={e => setEducationValue('description', e.target.value)}/></div>
    </> : <>
      <div className="field"><label htmlFor="career-organization">Organization</label>
        <input id="career-organization" required maxLength={200} disabled={saving} value={experience.organization} onChange={e => setExperienceValue('organization', e.target.value)}/></div>
      <div className="field"><label htmlFor="career-role">Role or position</label>
        <input id="career-role" required maxLength={200} disabled={saving} value={experience.title} onChange={e => setExperienceValue('title', e.target.value)}/></div>
      <div className="field"><label htmlFor="career-experience-type">Experience type</label>
        <select id="career-experience-type" disabled={saving} value={experience.experience_type} onChange={e => setExperienceValue('experience_type', e.target.value)}>
          <option value="work">Work</option><option value="internship">Internship</option><option value="volunteer">Volunteer</option><option value="project">Project</option><option value="other">Other</option>
        </select></div>
      <div className="field"><label htmlFor="career-start-date">Start date (optional)</label>
        <input id="career-start-date" type="date" disabled={saving} value={experience.start_date} onChange={e => setExperienceValue('start_date', e.target.value)}/></div>
      <label><input type="checkbox" disabled={saving} checked={experience.is_current} onChange={e => setExperienceValue('is_current', e.target.checked)}/> This experience is ongoing</label>
      {!experience.is_current && <div className="field"><label htmlFor="career-end-date">End date (optional)</label>
        <input id="career-end-date" type="date" disabled={saving} value={experience.end_date} onChange={e => setExperienceValue('end_date', e.target.value)}/></div>}
      <div className="field"><label htmlFor="career-experience-description">What I did (optional)</label>
        <textarea id="career-experience-description" maxLength={3000} disabled={saving} value={experience.description} onChange={e => setExperienceValue('description', e.target.value)}/></div>
    </>}
    <p className="field-hint">This record is saved privately, regardless of any previous employer-visibility setting. Verification cannot be self-approved.</p>
    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving record…' : 'Save private record'}</button>{' '}
    <button type="button" className="btn btn-secondary" disabled={saving} onClick={onCancel}>Cancel editing</button>
  </form>
}
