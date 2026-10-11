import { useState } from 'react'
import { saveRoleProfile } from '../lib/role-profile-save'

export default function EmployerProfileSetup({fullName,email,onComplete,role}: {
  fullName:string|null;email:string|null;onComplete:()=>void;role:'company'|'employer'
}) {
  const [name,setName]=useState(fullName ?? '')
  const [company,setCompany]=useState('')
  const [legalName,setLegalName]=useState('')
  const [regNumber,setRegNumber]=useState('')
  const [industry,setIndustry]=useState('')
  const [website,setWebsite]=useState('')
  const [title,setTitle]=useState('')
  const [description,setDescription]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('')
    if(role==='employer')return setError('This older employer account type needs an administrator to link it to the company profile workflow. No data has been changed.')
    if(name.trim().length<2||company.trim().length<2||!industry.trim())return setError('Your name, organization name and industry are required.')
    setBusy(true)
    try{
      await saveRoleProfile({role:'company',name,institution:company,details:{
        company_name:company.trim(),legal_name:legalName.trim(),business_registration_number:regNumber.trim(),
        industry:industry.trim(),website:website.trim(),representative_title:title.trim(),description:description.trim(),
      }})
      onComplete()
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save organization profile.')}
    finally{setBusy(false)}
  }
  return <div className="auth-shell"><div className="auth-card" style={{maxWidth:720}}>
    <span className="auth-wordmark">MELA · EMPLOYERS</span>
    <h1>Employer / organization profile</h1>
    <p className="auth-subtitle">Set up the organization and its authorized representative. Job publishing, student contact and organization verification remain subject to administrator approval.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {role==='employer' && <p className="banner banner-error" role="alert">Your existing account uses a legacy employer role that the current company verification function does not support. MELA administration must verify and migrate that role; do not register a duplicate employer account.</p>}
    <form onSubmit={e=>void submit(e)}>
      <div className="field"><label htmlFor="employer-name">Authorized representative name (required)</label><input id="employer-name" required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="employer-company">Organization name (required)</label><input id="employer-company" required maxLength={180} value={company} onChange={e=>setCompany(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="employer-industry">Industry / sector (required)</label><input id="employer-industry" required maxLength={120} placeholder="Education, Technology, Agriculture…" value={industry} onChange={e=>setIndustry(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="employer-legal">Registered legal name (optional)</label><input id="employer-legal" maxLength={200} value={legalName} onChange={e=>setLegalName(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="employer-registration">Registration number (optional, private)</label><input id="employer-registration" maxLength={120} value={regNumber} onChange={e=>setRegNumber(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="employer-website">Company website (optional)</label><input id="employer-website" type="url" maxLength={250} value={website} onChange={e=>setWebsite(e.target.value)} disabled={busy} placeholder="https://example.org"/></div>
      <div className="field"><label htmlFor="employer-title">Your job title (optional)</label><input id="employer-title" maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="employer-description">About your organization (optional)</label><textarea id="employer-description" maxLength={1600} value={description} onChange={e=>setDescription(e.target.value)} disabled={busy}/></div>
      <p className="field-hint">Saving organization details does not approve vacancies, payments or direct contact with minors.</p>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy||role==='employer'}>{busy?'Saving employer profile…':'Save employer profile'}</button>
    </form>
    <p className="field-hint">Signed-in account: {email ?? 'verified organization account'}</p>
  </div></div>
}
