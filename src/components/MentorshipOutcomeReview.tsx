import { useEffect,useRef,useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MentorshipSession } from '../lib/mentorship'

const CATEGORIES=[
  {value:'academic',label:'Academic progress'},
  {value:'career',label:'Career exploration'},
  {value:'technical',label:'Technical skills'},
  {value:'business',label:'Business or entrepreneurship'},
  {value:'research',label:'Research skills'},
  {value:'other',label:'Other learning outcome'},
] as const
type OutcomeCategory=(typeof CATEGORIES)[number]['value']
type Verification={claim_id:string;decision:'evidence_supported'|'evidence_rejected';public_reason:string}
type Outcome={
 id:string;session_id:string;learner_id:string;mentor_id:string;
 category:OutcomeCategory;outcome_text:string;status:string;
 review_notes:string|null;created_at:string
}

export default function MentorshipOutcomeReview({
 mode,sessions=[]
}:{
 mode:'learner'|'mentor';sessions?:MentorshipSession[]
}){
 const [claims,setClaims]=useState<Outcome[]>([])
 const [verifications,setVerifications]=useState<Verification[]>([])
 const [sessionId,setSessionId]=useState('')
 const [category,setCategory]=useState<OutcomeCategory>('career')
 const [outcome,setOutcome]=useState('')
 const [draftNotes,setDraftNotes]=useState<Record<string,string>>({})
 const [loading,setLoading]=useState(true)
 const [historyVerified,setHistoryVerified]=useState(false)
 const [verificationError,setVerificationError]=useState('')
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [revision,setRevision]=useState(0)
 const lock=useRef(false)
 const accountEpoch=useRef(0)
 useEffect(()=>{
  const reset=(reload:boolean)=>{
   accountEpoch.current+=1;lock.current=false
   setClaims([]);setVerifications([]);setSessionId('');setCategory('career')
   setOutcome('');setDraftNotes({});setHistoryVerified(false)
   setVerificationError('');setError('');setNotice('');setBusy(false);setLoading(true)
   if(reload)setRevision(n=>n+1)
  }
  reset(false)
  const clear=()=>reset(true)
  window.addEventListener('mela:session-boundary',clear)
  return()=>{
   accountEpoch.current+=1
   window.removeEventListener('mela:session-boundary',clear)
  }
 },[mode])
 const completed=sessions.filter(s=>s.status==='completed'&&s.completed_at)
 const eligibleSession=completed.find(s=>s.id===sessionId)
 const submitted=claims.some(c=>c.session_id===sessionId&&c.category===category)

 useEffect(()=>{
  let active=true;const epoch=accountEpoch.current;setLoading(true);setHistoryVerified(false);setVerificationError('');setError('');setClaims([]);setVerifications([])
  void (async()=>{
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser()
      if(!active||epoch!==accountEpoch.current)return
      if(authError)throw new Error(authError.message)
      if(!auth.user)throw new Error('Sign in to view mentorship learning outcomes.')
      const filterColumn=mode==='learner'?'learner_id':'mentor_id'
      const {data,error:readError}=await supabase.from('mentorship_outcome_claims')
        .select('id,session_id,learner_id,mentor_id,category,outcome_text,status,review_notes,created_at')
        .eq(filterColumn,auth.user.id).order('created_at',{ascending:false}).limit(100)
      if(!active||epoch!==accountEpoch.current)return
      if(readError)throw new Error(readError.message)
      const ownClaims = (data??[]) as Outcome[]
      let ownVerifications: Verification[] = []
      let verificationProblem = ''
      if(mode==='learner'&&ownClaims.length){
        try {
          const {data:reviewData,error:reviewError}=await supabase
            .from('mentorship_outcome_verifications')
            .select('claim_id,decision,public_reason').in('claim_id',ownClaims.map(c=>c.id))
          if(reviewError)throw new Error(reviewError.message)
          ownVerifications=(reviewData??[]) as Verification[]
        }catch(cause){
          verificationProblem=cause instanceof Error ? cause.message : 'Administrator review details are unavailable.'
        }
      }
      if(active&&epoch===accountEpoch.current){
        setClaims(ownClaims);setVerifications(ownVerifications)
        setVerificationError(verificationProblem);setHistoryVerified(true)
      }
    }catch(cause){
      if(active&&epoch===accountEpoch.current)setError(cause instanceof Error?cause.message:'Could not load mentorship outcomes.')
    }finally{if(active&&epoch===accountEpoch.current)setLoading(false)}
  })()
  return()=>{active=false}
 },[mode,revision])

 const act=async(work:(epoch:number)=>Promise<void>,success:string)=>{
  if(lock.current||loading||!historyVerified){
    if(!loading&&!historyVerified) setError('Verify your private outcome history before changing evidence. Use Refresh after access is restored.')
    return
  }
  const epoch=accountEpoch.current
  lock.current=true;setBusy(true);setError('');setNotice('')
  try{
    await work(epoch)
    if(epoch!==accountEpoch.current)return
    setNotice(success)
    setRevision(n=>n+1)
  }catch(cause){
    if(epoch===accountEpoch.current)setError(cause instanceof Error?cause.message:'Your mentorship outcome could not be saved.')
  }finally{if(epoch===accountEpoch.current){lock.current=false;setBusy(false)}}
 }

 const claim=(event:React.FormEvent)=>{
  event.preventDefault()
  if(loading||!historyVerified||!eligibleSession||submitted||outcome.trim().length<20)return
  void act(async(epoch)=>{
    const {data:auth,error:authError}=await supabase.auth.getUser()
    if(epoch!==accountEpoch.current)return
    if(authError)throw new Error(authError.message)
    if(!auth.user)throw new Error('Your sign-in session has expired.')
    if(!eligibleSession.mentor_id)throw new Error('Completed session has no verified mentor.')
    const {data:saved,error:writeError}=await supabase.from('mentorship_outcome_claims').insert({
      session_id:eligibleSession.id,learner_id:auth.user.id,
      mentor_id:eligibleSession.mentor_id,category,outcome_text:outcome.trim(),
    }).select('id')
    if(writeError)throw new Error(writeError.message)
    if(!saved?.length)throw new Error('Outcome claim was not confirmed by the database. Refresh and check your saved claims before retrying.')
    if(epoch===accountEpoch.current)setOutcome('')
  },'Your outcome evidence has been submitted for mentor review. No credential or certificate has been issued.')
 }

 const decide=(id:string,status:'mentor_supported'|'not_supported')=>{
  const notes=(draftNotes[id]??'').trim()
  if(loading||!historyVerified||notes.length<20)return
  void act(async(epoch)=>{
    const {data:auth,error:authError}=await supabase.auth.getUser()
    if(epoch!==accountEpoch.current)return
    if(authError)throw new Error(authError.message)
    if(!auth.user)throw new Error('Your sign-in session has expired.')
    const {data,error:reviewError}=await supabase.from('mentorship_outcome_claims')
      .update({status,review_notes:notes,reviewer_id:auth.user.id,
        reviewed_at:new Date().toISOString()})
      .eq('id',id).eq('status','submitted').eq('mentor_id',auth.user.id).select('id')
    if(reviewError)throw new Error(reviewError.message)
    if(!data?.length)throw new Error('The outcome was already reviewed or your account is not the verified mentor.')
    if(epoch===accountEpoch.current)setDraftNotes(old=>({...old,[id]:''}))
  },'Mentor outcome review recorded. This is not a Career Passport credential.')
 }

 return <section id="mentorship-outcomes" className="empty-panel" style={{textAlign:'left'}}
     aria-label={mode==='learner'?'My mentorship learning evidence':'Mentor evidence review'}>
   <h2>{mode==='learner'?'My mentorship outcomes':'Review learner mentorship outcomes'}</h2>
   <p>After a completed session, learners can record specific outcomes.
      Their verified mentor may review the statement once. A supportive review is not an independent certificate, official qualification, employer endorsement or Career Passport award.</p>
   {error&&<p role="alert" className="banner banner-error">{error}</p>}
   {notice&&<p role="status" className="banner banner-info">{notice}</p>}
   {verificationError&&<p role="status" className="banner banner-info">
     Your saved outcome claims are available, but independent administrator verification details could not be loaded: {verificationError}. No verification result is assumed. Use Refresh to retry.
   </p>}
   {!loading&&!historyVerified&&<p role="status" className="banner banner-info">
     Outcome history is unavailable. Existing claims cannot be checked. Submissions and reviews are paused to prevent duplicates. Use Refresh when the connection returns.
   </p>}
   {mode==='learner'&&<section>
     {completed.length===0?<p className="muted">No completed mentorship sessions are available for an evidence claim yet.</p>:
       <form onSubmit={claim}>
         <div className="field"><label htmlFor="outcome-session">Completed session</label>
           <select id="outcome-session" value={sessionId} disabled={busy} required
             onChange={event=>setSessionId(event.target.value)}>
             <option value="">Choose completed session</option>
             {completed.map(s=><option key={s.id} value={s.id}>
               {new Date(s.scheduled_at).toLocaleString()}
             </option>)}
           </select>
         </div>
         <div className="field"><label htmlFor="outcome-category">Learning outcome area</label>
           <select id="outcome-category" value={category} disabled={busy}
             onChange={event=>setCategory(event.target.value as OutcomeCategory)}>
             {CATEGORIES.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
           </select>
         </div>
         <div className="field"><label htmlFor="outcome-evidence">What did you actually learn or produce?</label>
           <textarea id="outcome-evidence" value={outcome} minLength={20} maxLength={2000}
             rows={4} disabled={busy||loading||!historyVerified||submitted} required
             onChange={event=>setOutcome(event.target.value)}
             placeholder="Describe the session-specific learning or work, not a claim of certification."/>
         </div>
         {submitted&&<p role="status">You already submitted an outcome in this category for this session.</p>}
         <button type="submit" className="btn btn-primary"
           disabled={busy||loading||!historyVerified||!eligibleSession||submitted||outcome.trim().length<20}>
           {busy?'Submitting…':'Submit for mentor review'}
         </button>
       </form>}
   </section>}
   {loading?<p role="status">Loading recorded learning evidence…</p>:
    !historyVerified ? <p className="muted">Your private outcomes cannot be verified. This is not a confirmed empty history.</p> :
    claims.length===0?<p className="muted">No recorded outcome claims yet.</p>:
      <div className="list-panel">{claims.map(item=><article className="list-row"
        key={item.id} style={{display:'block'}}>
        <strong>{CATEGORIES.find(c=>c.value===item.category)?.label??item.category}</strong>
        <p>{item.outcome_text}</p>
        <p className="muted">Status: {item.status==='mentor_supported'?'Mentor supported (not certified)':
          item.status==='not_supported'?'Mentor could not support claim':'Waiting for mentor review'} ·
          Submitted {new Date(item.created_at).toLocaleDateString()}</p>
        {item.review_notes&&<p><strong>Mentor review:</strong> {item.review_notes}</p>}
        {mode==='learner'&&verifications.filter(r=>r.claim_id===item.id).map(r=>
          <p key={r.claim_id}><strong>Independent evidence review:</strong> {r.decision==='evidence_supported'
            ? 'Supporting evidence reviewed by MELA administration' : 'Evidence not independently supported'}.
            {' '}{r.public_reason} This review does not issue a certificate, qualification or Career Passport credential.</p>
        )}
        {mode==='mentor'&&item.status==='submitted'&&
          <section>
            <div className="field"><label htmlFor={'outcome-review-'+item.id}>Review evidence and explain your decision</label>
              <textarea id={'outcome-review-'+item.id} minLength={20} maxLength={2000}
                disabled={busy||loading||!historyVerified} rows={3} value={draftNotes[item.id]??''}
                onChange={event=>setDraftNotes(old=>({...old,[item.id]:event.target.value}))}/>
            </div>
            <button type="button" className="btn btn-primary" disabled={busy||loading||!historyVerified||(draftNotes[item.id]??'').trim().length<20}
              onClick={()=>decide(item.id,'mentor_supported')}>Support this outcome</button>{' '}
            <button type="button" className="btn btn-secondary" disabled={busy||loading||!historyVerified||(draftNotes[item.id]??'').trim().length<20}
              onClick={()=>decide(item.id,'not_supported')}>Do not support this outcome</button>
          </section>}
      </article>)}</div>}
   <button type="button" className="btn btn-secondary" disabled={busy||loading} onClick={()=>setRevision(n=>n+1)}>
     Refresh outcome reviews
   </button>
 </section>
}
