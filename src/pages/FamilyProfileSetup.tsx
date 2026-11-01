import { useEffect, useState } from 'react'
import { loadProfileDraft, saveProfileDraft, clearProfileDraft } from '../lib/profile-onboarding-drafts'
import { parseSafeList, saveRoleProfile } from '../lib/role-profile-save'

export default function FamilyProfileSetup({fullName,email,onComplete}: {fullName:string|null;email:string|null;onComplete:()=>void}) {
  const [name,setName]=useState(fullName ?? '')
  const [region,setRegion]=useState('')
  const [city,setCity]=useState('')
  const [occupation,setOccupation]=useState('')
  const [interests,setInterests]=useState('')
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [draftBusy,setDraftBusy]=useState(false)
  const [draftNotice,setDraftNotice]=useState('')
  useEffect(()=>{
    let active=true
    void loadProfileDraft('parent').then(draft=>{
      if(!active||!draft)return
      if(typeof draft.name==='string')setName(draft.name)
      if(typeof draft.region==='string')setRegion(draft.region)
      if(typeof draft.city==='string')setCity(draft.city)
      if(typeof draft.occupation==='string')setOccupation(draft.occupation)
      if(typeof draft.interests==='string')setInterests(draft.interests)
      setDraftNotice('Saved family profile draft restored.')
    }).catch(()=>{if(active)setDraftNotice('Saved drafts are temporarily unavailable; your current form remains editable.')})
    return ()=>{active=false}
  },[])
  const saveDraft=async()=>{
    setError('');setDraftBusy(true)
    try{
      await saveProfileDraft('parent',{name,region,city,occupation,interests})
      setDraftNotice('Draft saved privately to your MELA account. You can finish later.')
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not save draft. Check your connection and retry.')}
    finally{setDraftBusy(false)}
  }
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('')
    if(name.trim().length<2) return setError('Please enter your full name.')
    setBusy(true)
    try {
      await saveRoleProfile({role:'parent',name,city,region,details:{
        occupation:occupation.trim(),interests:parseSafeList(interests),skills:[],employment_preferences:[],
      }})
      await clearProfileDraft('parent').catch(()=>{})
      onComplete()
    }catch(cause){setError(cause instanceof Error?cause.message:'Unable to save family profile.')}
    finally{setBusy(false)}
  }
  return <div className="auth-shell"><div className="auth-card" style={{maxWidth:720}}>
    <span className="auth-wordmark">MELA · FAMILY</span>
    <h1>Family / guardian profile</h1>
    <p className="auth-subtitle">Set up your own family account first. Linking to a child is a separate consent- and verification-protected step; no child information is required here.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {draftNotice && <p className="field-hint" role="status">{draftNotice}</p>}
    <form onSubmit={e=>void submit(e)}>
      <div className="field"><label htmlFor="family-name">Full name (required)</label><input id="family-name" required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="family-region">Region (optional)</label><input id="family-region" maxLength={100} value={region} onChange={e=>setRegion(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="family-city">City (optional)</label><input id="family-city" maxLength={100} autoComplete="address-level2" value={city} onChange={e=>setCity(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="family-occupation">Occupation (optional)</label><input id="family-occupation" maxLength={120} value={occupation} onChange={e=>setOccupation(e.target.value)} disabled={busy}/></div>
      <div className="field"><label htmlFor="family-interests">How you want to support learning (optional)</label><input id="family-interests" maxLength={400} placeholder="Homework support, reading, school updates" value={interests} onChange={e=>setInterests(e.target.value)} disabled={busy}/></div>
      <p className="field-hint">Family members cannot see student records until MELA verifies a guardian/student link.</p>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy||draftBusy}>{busy?'Saving family profile…':'Save family profile'}</button>
      <button type="button" className="btn btn-secondary btn-block" disabled={busy||draftBusy} onClick={()=>void saveDraft()}>{draftBusy?'Saving draft…':'Save draft and finish later'}</button>
    </form>
    <p className="field-hint">Signed-in account: {email ?? 'verified family account'}</p>
  </div></div>
}
