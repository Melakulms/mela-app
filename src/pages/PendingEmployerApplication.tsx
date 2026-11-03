import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type EmployerRequest = {
  id: string
  status: string
  company_name: string
  legal_name: string | null
  registration_number: string | null
  industry: string | null
  website: string | null
  description: string | null
}

const tidy = (value: string, max: number) => value.trim().slice(0,max)

/** For verified-contact, legacy "employer" accounts that have not passed
 * separate organizational approval. This is an application, not a profile
 * completion, role promotion or authorization to contact learners.
 */
export default function PendingEmployerApplication({onRefresh,onSignOut,onOpenPrivacy}:{
  onRefresh:()=>void
  onSignOut:()=>void
  onOpenPrivacy?:()=>void
}) {
  const [request,setRequest]=useState<EmployerRequest|null>(null)
  const [company,setCompany]=useState('')
  const [legalName,setLegalName]=useState('')
  const [registrationNumber,setRegistrationNumber]=useState('')
  const [industry,setIndustry]=useState('')
  const [website,setWebsite]=useState('')
  const [description,setDescription]=useState('')
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  useEffect(()=>{
    let active=true
    const load=async()=>{
      try{
        const {data:auth,error:authError}=await supabase.auth.getUser()
        if(authError||!auth.user)throw new Error('Please sign in again.')
        const {data,error:readError}=await supabase.from('employer_registration_requests')
          .select('id,status,company_name,legal_name,registration_number,industry,website,description')
          .eq('applicant_user_id',auth.user.id)
          .order('created_at',{ascending:false}).limit(1).maybeSingle()
        if(readError)throw readError
        if(!active)return
        const found=data as EmployerRequest|null
        setRequest(found)
        if(found){
          setCompany(found.company_name??'')
          setLegalName(found.legal_name??'')
          setRegistrationNumber(found.registration_number??'')
          setIndustry(found.industry??'')
          setWebsite(found.website??'')
          setDescription(found.description??'')
        }
      }catch(e){if(active)setError(e instanceof Error?e.message:'Could not load your employer application.')}
      finally{if(active)setLoading(false)}
    }
    void load()
    return ()=>{active=false}
  },[])

  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();setError('');setNotice('')
    if(tidy(company,180).length<2||tidy(industry,120).length<2){
      setError('Organization name and industry are required.');return
    }
    if(website.trim()&&!/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#].*)?$/i.test(website.trim())){
      setError('Use an HTTPS organization website or leave the field blank.');return
    }
    if(request&&request.status!=='pending'){
      setError('A reviewer must resolve the existing application before you can submit changes.');return
    }
    setBusy(true)
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser()
      if(authError||!auth.user)throw new Error('Please sign in again.')
      const payload={
        company_name:tidy(company,180),
        legal_name:tidy(legalName,200)||null,
        registration_number:tidy(registrationNumber,120)||null,
        industry:tidy(industry,120),
        website:tidy(website,250)||null,
        description:tidy(description,1600)||null,
      }
      if(request){
        const {data,error}=await supabase.from('employer_registration_requests')
          .update(payload).eq('id',request.id).eq('applicant_user_id',auth.user.id)
          .eq('status','pending').select('id').maybeSingle()
        if(error)throw error
        if(!data)throw new Error('The request is now under review and cannot be edited.')
      }else{
        const {data,error}=await supabase.from('employer_registration_requests')
          .insert({...payload,applicant_user_id:auth.user.id,status:'pending'})
          .select('id,status').single()
        if(error)throw error
        setRequest({...payload,id:data.id,status:data.status})
      }
      setNotice('Your employer application was saved for independent review. Job posting and access to learners remain disabled.')
    }catch(e){setError(e instanceof Error?e.message:'Unable to submit the employer application.')}
    finally{setBusy(false)}
  }
  return <main className="auth-shell"><div className="auth-card" style={{maxWidth:720}}>
    <span className="auth-wordmark">MELA · EMPLOYERS</span>
    <h1>Complete your organization application</h1>
    {onOpenPrivacy && <button type="button" className="btn btn-secondary" onClick={onOpenPrivacy}>Privacy and data requests</button>}
    <p className="auth-subtitle">Your login contact is confirmed, but MELA has not approved this legacy employer account. Supply your organization's details for verification without registering again.</p>
    <p className="field-hint">Submitting this form does not activate your account or allow hiring, payments, student contact or publication.</p>
    {loading?<p role="status">Loading existing application…</p>:<>
      {request&&<p role="status">Application status: <strong>{request.status.replaceAll('_',' ')}</strong></p>}
      {error&&<p role="alert" className="banner banner-error">{error}</p>}
      {notice&&<p role="status" className="banner banner-info">{notice}</p>}
      {(!request||request.status==='pending')&&
        <form onSubmit={e=>void submit(e)}>
          <div className="field"><label htmlFor="pending-employer-name">Organization name (required)</label><input id="pending-employer-name" required minLength={2} maxLength={180} value={company} onChange={e=>setCompany(e.target.value)} disabled={busy}/></div>
          <div className="field"><label htmlFor="pending-employer-industry">Industry (required)</label><input id="pending-employer-industry" required minLength={2} maxLength={120} value={industry} onChange={e=>setIndustry(e.target.value)} disabled={busy}/></div>
          <div className="field"><label htmlFor="pending-employer-legal">Legal name (optional)</label><input id="pending-employer-legal" maxLength={200} value={legalName} onChange={e=>setLegalName(e.target.value)} disabled={busy}/></div>
          <div className="field"><label htmlFor="pending-employer-registration">Registration number (private, optional)</label><input id="pending-employer-registration" maxLength={120} value={registrationNumber} onChange={e=>setRegistrationNumber(e.target.value)} disabled={busy}/></div>
          <div className="field"><label htmlFor="pending-employer-website">Website (optional)</label><input id="pending-employer-website" type="url" maxLength={250} placeholder="https://example.org" value={website} onChange={e=>setWebsite(e.target.value)} disabled={busy}/></div>
          <div className="field"><label htmlFor="pending-employer-description">Organization description (optional)</label><textarea id="pending-employer-description" maxLength={1600} value={description} onChange={e=>setDescription(e.target.value)} disabled={busy}/></div>
          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy?'Saving application…':request?'Update pending application':'Submit organization for review'}</button>
        </form>}
      <button type="button" className="btn btn-secondary btn-block" onClick={onRefresh} disabled={busy}>Check approval status</button>
      <button type="button" className="btn btn-secondary btn-block" onClick={onSignOut} disabled={busy}>Sign out</button>
    </>}
  </div></main>
}
