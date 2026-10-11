import { useState } from 'react'
import { parseSafeList, saveRoleProfile } from '../lib/role-profile-save'

export default function FamilyProfileSetup({fullName,email,onComplete}: {fullName:string|null;email:string|null;onComplete:()=>void}) {
  const [name,setName]=useState(fullName ?? '')
  const [region,setRegion]=useState('')
  const [city,setCity]=useState('')
  const [occupation,setOccupation]=useState('')
  const [interests,setInterests]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('')
    if(name.trim().length<2) return setError('Please enter your full name.')
    setBusy(true)
    try {
      await saveRoleProfile({role:'parent',name,city,region,details:{
        occupation:occupation.trim(),interests:parseSafeList(interests),skills:[],employment_preferences:[],
      }})
      onComplete()
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save family profile.')}
    finally{setBusy(false)}
  }
  return <div className="auth-shell"><div className="auth-card" style={{maxWidth:720}}>
    <span className="auth-wordmark">MELA · FAMILY</span>
    <h1>Family / guardian profile</h1>
    <p className="auth-subtitle">Set up your own family account first. Linking to a child is a separate consent- and verification-protected step; no child information is required here.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    <form onSubmit={e=>void submit(e)}>
      <div className="field"><label htmlFor="family-name">Full name (required)</label><input id="family-name" required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="family-region">Region (optional)</label><input id="family-region" maxLength={100} value={region} onChange={e=>setRegion(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="family-city">City (optional)</label><input id="family-city" maxLength={100} autoComplete="address-level2" value={city} onChange={e=>setCity(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="family-occupation">Occupation (optional)</label><input id="family-occupation" maxLength={120} value={occupation} onChange={e=>setOccupation(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="family-interests">How you want to support learning (optional)</label><input id="family-interests" maxLength={400} placeholder="Homework support, reading, school updates" value={interests} onChange={e=>setInterests(e.target.value)} disabled={busy}/></div>
      <p className="field-hint">Family members cannot see student records until MELA verifies a guardian/student link.</p>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy?'Saving family profile…':'Save family profile'}</button>
    </form>
    <p className="field-hint">Signed-in account: {email ?? 'verified family account'}</p>
  </div></div>
}
