import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Props = { role: 'parent' | 'teacher' | 'company'; fullName: string | null; email: string | null; onComplete: () => void }

export default function RoleProfileSetup({ role, fullName, email, onComplete }: Props) {
  const [name, setName] = useState(fullName ?? '')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [occupation, setOccupation] = useState('')
  const [interests, setInterests] = useState('')
  const [skills, setSkills] = useState('')
  const [qualification, setQualification] = useState('')
  const [subjects, setSubjects] = useState('')
  const [grades, setGrades] = useState('')
  const [experience, setExperience] = useState('0')
  const [biography, setBiography] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [industry, setIndustry] = useState('')
  const [website, setWebsite] = useState('')
  const [representativeTitle, setRepresentativeTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const title = useMemo(() => role === 'company' ? 'Set up your company profile' : role === 'teacher' ? 'Set up your teacher profile' : 'Set up your parent profile', [role])

  const list = (v: string) => v.split(',').map(x => x.trim()).filter(Boolean)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (trimmedName.length < 2) return setError('Please enter your full name.')
    if (role === 'company' && companyName.trim().length < 2) return setError('Company name is required.')
    if (role === 'teacher' && !qualification.trim()) return setError('Qualification is required for teacher accounts.')
    const years = Number(experience)
    if (role === 'teacher' && (!Number.isInteger(years) || years < 0 || years > 80)) return setError('Teaching experience must be between 0 and 80 years.')

    setBusy(true)
    try {
      const details =
        role === 'parent'
          ? { occupation: occupation.trim(), interests: list(interests), skills: list(skills), employment_preferences: [] }
          : role === 'teacher'
            ? { qualification: qualification.trim(), subjects_taught: list(subjects), grade_levels: list(grades), teaching_experience_years: years, skills: list(skills), certifications: [], biography: biography.trim(), teaching_interests: list(interests) }
            : { company_name: companyName.trim(), legal_name: legalName.trim(), business_registration_number: registrationNumber.trim(), industry: industry.trim(), website: website.trim(), representative_title: representativeTitle.trim(), description: description.trim() }

      const { error: rpcError } = await supabase.rpc('complete_my_profile_v37', {
        p_full_name: trimmedName,
        p_preferred_language: 'en',
        p_city: city.trim() || null,
        p_region: region.trim() || null,
        p_institution_name: role === 'company' ? companyName.trim() : null,
        p_details: details,
      })
      if (rpcError) throw rpcError
      onComplete()
    } catch (err: any) {
      setError(err?.message ?? 'Could not save your profile. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="auth-shell"><div className="auth-card" style={{ maxWidth: 720 }}>
    <span className="auth-wordmark">MELA</span>
    <h1>{title}</h1>
    <p className="auth-subtitle">This information is saved to your MELA profile and used to personalize your account.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    <form onSubmit={save}>
      <div className="field"><label htmlFor="rp-name">Full name</label><input id="rp-name" required minLength={2} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="rp-city">City (optional)</label><input id="rp-city" autoComplete="address-level2" value={city} onChange={e=>setCity(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="rp-region">Region (optional)</label><input id="rp-region" value={region} onChange={e=>setRegion(e.target.value)} disabled={busy}/></div>
      {role === 'parent' && <>
        <div className="field"><label htmlFor="rp-occ">Occupation (optional)</label><input id="rp-occ" value={occupation} onChange={e=>setOccupation(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-interest">Interests (comma separated)</label><input id="rp-interest" value={interests} onChange={e=>setInterests(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-skills">Skills (comma separated)</label><input id="rp-skills" value={skills} onChange={e=>setSkills(e.target.value)} disabled={busy}/></div>
      </>}
      {role === 'teacher' && <>
        <div className="field"><label htmlFor="rp-qual">Qualification</label><input id="rp-qual" required value={qualification} onChange={e=>setQualification(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-subjects">Subjects taught (comma separated)</label><input id="rp-subjects" value={subjects} onChange={e=>setSubjects(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-grades">Grade levels (comma separated)</label><input id="rp-grades" value={grades} onChange={e=>setGrades(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-exp">Teaching experience (years)</label><input id="rp-exp" type="number" min="0" max="80" value={experience} onChange={e=>setExperience(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-interest">Teaching interests (comma separated)</label><input id="rp-interest" value={interests} onChange={e=>setInterests(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-skills">Skills (comma separated)</label><input id="rp-skills" value={skills} onChange={e=>setSkills(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-bio">Biography (optional)</label><textarea id="rp-bio" value={biography} onChange={e=>setBiography(e.target.value)} disabled={busy}/></div>
      </>}
      {role === 'company' && <>
        <div className="field"><label htmlFor="rp-company">Company name</label><input id="rp-company" required value={companyName} onChange={e=>setCompanyName(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-legal">Legal name (optional)</label><input id="rp-legal" value={legalName} onChange={e=>setLegalName(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-reg">Business registration number (optional)</label><input id="rp-reg" value={registrationNumber} onChange={e=>setRegistrationNumber(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-industry">Industry (optional)</label><input id="rp-industry" value={industry} onChange={e=>setIndustry(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-website">Website (optional)</label><input id="rp-website" type="url" value={website} onChange={e=>setWebsite(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-title">Representative title (optional)</label><input id="rp-title" value={representativeTitle} onChange={e=>setRepresentativeTitle(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="rp-description">Company description (optional)</label><textarea id="rp-description" value={description} onChange={e=>setDescription(e.target.value)} disabled={busy}/></div>
      </>}
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Saving your profile…' : 'Continue to MELA'}</button>
    </form>
    <p className="field-hint">Account email: {email ?? 'verified account'}</p>
  </div></div>
}
