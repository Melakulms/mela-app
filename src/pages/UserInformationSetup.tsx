import { lazy, Suspense, useEffect, useState } from 'react'
import type { MelaProfile } from '../lib/auth'
import { INFORMATION_VERSION, informationErrors, informationFields, loadUserInformation, saveUserInformation } from '../lib/user-information'
const SafetyCenter = lazy(() => import('./SafetyCenter'))

export default function UserInformationSetup({profile,editMode=false,onComplete,onSignOut}: {
  profile: MelaProfile; editMode?: boolean; onComplete: () => void; onSignOut: () => void
}) {
  const [details,setDetails] = useState<Record<string,string>>({preferred_language:profile.preferred_language})
  const [loaded,setLoaded] = useState(false)
  const [revision,setRevision] = useState(0)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [showSafety,setShowSafety] = useState(false)
  const fields = informationFields(profile.role)
  useEffect(() => {
    let active = true
    setLoaded(false); setError('')
    loadUserInformation(profile.id).then(saved => {
      if (!active) return
      // Old information for another role never completes a newly assigned role.
      if (saved?.role === profile.role) {
        setDetails(saved.details)
        if (!editMode && saved.completed && saved.notice_version === INFORMATION_VERSION && !informationErrors(profile.role,saved.details).length) {
          onComplete(); return
        }
      }
      setLoaded(true)
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your information.') })
    return () => {active=false}
  }, [profile.id,profile.role,revision,editMode])

  const save = async (complete: boolean) => {
    if (busy || !loaded) return
    setBusy(true); setError(''); setNotice('')
    try {
      await saveUserInformation(profile.id,profile.role,details,complete)
      if (complete) onComplete()
      else setNotice('Draft saved to your account. You can sign out and continue later.')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your information.') }
    finally {setBusy(false)}
  }
  if (showSafety) return <Suspense fallback={<p role="status">Loading safety and support…</p>}><SafetyCenter onBack={()=>setShowSafety(false)}/></Suspense>
  return <main className="auth-shell"><section className="auth-card" style={{maxWidth:720}} aria-labelledby="information-title">
    <span className="auth-wordmark">MELA · YOUR INFORMATION</span>
    <h1 id="information-title">{editMode ? 'Review your information' : 'Complete your information'}</h1>
    <p>Welcome, {profile.full_name || 'MELA user'}. Your account type is <strong>{profile.role === 'parent' ? 'Parent / guardian' : profile.role === 'company' ? 'Employer / organization' : profile.role}</strong>.</p>
    <p>Save the required information to continue to your role profile and MELA features. Optional fields can be left blank. Your existing account and education records are kept.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {notice && <p className="banner banner-info" role="status">{notice}</p>}
    {!loaded && !error && <p role="status">Loading your saved information…</p>}
    {!loaded && error && <button type="button" className="btn btn-primary" onClick={()=>setRevision(n=>n+1)}>Try again</button>}
    {loaded && !fields.length && <p role="alert">This account type needs MELA support before profile setup can continue.</p>}
    {loaded && fields.length > 0 && <form onSubmit={event=>{event.preventDefault();void save(true)}}>
      <fieldset disabled={busy} style={{border:0,padding:0,margin:0}}>
      {fields.map(field => <div className="field" key={field.key}>
        <label htmlFor={`info-${field.key}`}>{field.label}{field.required ? ' (required)' : ''}</label>
        {field.options ? <select id={`info-${field.key}`} required={field.required} value={details[field.key] ?? ''}
          onChange={event=>setDetails(current=>({...current,[field.key]:event.target.value}))}>
          <option value="">Choose an option</option>
          {field.options.map(option=><option key={option} value={option}>{option}</option>)}
        </select> : field.multiline ? <textarea id={`info-${field.key}`} required={field.required} maxLength={field.max ?? 250}
          value={details[field.key] ?? ''} onChange={event=>setDetails(current=>({...current,[field.key]:event.target.value}))}/>
          : <input id={`info-${field.key}`} required={field.required} maxLength={field.max ?? 250}
            value={details[field.key] ?? ''} onChange={event=>setDetails(current=>({...current,[field.key]:event.target.value}))}/>}
      </div>)}
      <section aria-labelledby="information-notice"><h2 id="information-notice">How MELA uses this information</h2>
        <p>These answers are stored privately in your account for profile setup and service personalization. Other learners, employers and mentors cannot browse these answers. Authorized service operators may access them to operate and support MELA.</p>
        <p>Your display-name preference is saved here; it does not replace your name in every existing MELA feature. Do not enter an exact home address, identity document number, bank details, passwords, PINs or verification codes. Do not enter a child's name or contact details here.</p>
        <p>Age group is self-reported, not identity verification. Saving this form does not change your permissions, verify a guardian link, approve a teacher or mentor, publish an opportunity, or activate a paid plan.</p>
        <p>Guardian links, professional credentials and safeguarding approvals use separate verification. Plans and referral commissions depend on verified payments. This form does not collect money or enroll you in marketing.</p>
        <p>You can review these answers using “My information” after setup. For account-data requests or safeguarding concerns, open Safety and support.</p>
      </section>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save information & continue'}</button>
      <button className="btn btn-secondary btn-block" type="button" disabled={busy} onClick={()=>void save(false)}>Save draft for later</button>
      </fieldset>
    </form>}
    <div className="settings-buttons"><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setShowSafety(true)}>Safety and support</button>
    <button type="button" className="btn btn-secondary" disabled={busy} onClick={onSignOut}>Sign out</button></div>
  </section></main>
}
