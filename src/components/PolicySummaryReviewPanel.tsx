import {useEffect,useState} from 'react'
import {supabase} from '../lib/supabase'

type Policy = {policy_key:string;version:string;title:string;status:string}
type Receipt = {policy_key:string;policy_version:string}
const validKeys = ['terms','privacy'] as const
type Key = typeof validKeys[number]
const summaries:Record<Key,string[]> = {
  terms:[
    'Only use your own account and give accurate age, role and education information. Do not bypass learner safeguarding or professional identity checks.',
    'Do not harass, exploit, impersonate, defraud or solicit private contact, money or passwords from other people, especially children.',
    'Educational, scholarship, opportunity and AI information may be inaccurate. Verify important requirements with original institutions.',
    'MELA can restrict access to protect users or meet legal obligations. Professional roles, payments and private learner contact remain separately gated.',
  ],
  privacy:[
    'MELA may process account contact information, role and education details, progress records, guardian relationships, professional verification and safety reports to deliver requested services and protect learners.',
    'Children have additional safeguards. A code and a student-submitted guardian email alone do not establish guardian consent or access to a child’s records.',
    'Service providers may operate hosting, email, AI, analytics and payment systems only where those features are enabled. Final legal notices must identify relevant processors and data locations.',
    'A qualified Ethiopian legal/privacy reviewer must approve final purposes, legal bases, retention periods, deletion and privacy-request routes before MELA treats these summaries as legally sufficient.',
  ],
}
export default function PolicySummaryReviewPanel({userId}:{userId:string}){
  const [policies,setPolicies]=useState<Policy[]>([])
  const [receipts,setReceipts]=useState<Receipt[]>([])
  const [checked,setChecked]=useState<Record<Key,boolean>>({terms:false,privacy:false})
  const [busy,setBusy]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [revision,setRevision]=useState(0)
  useEffect(()=>{
    let active=true;setLoading(true);setError('')
    void (async()=>{
      try{
        const {data:auth,error:authError}=await supabase.auth.getUser()
        if(authError||auth.user?.id!==userId)throw new Error('Sign in again to view your policy records.')
        const [documents,reviews]=await Promise.all([
          supabase.from('policy_documents').select('policy_key,version,title,status')
            .eq('status','active').in('policy_key',validKeys),
          supabase.from('policy_summary_review_receipts').select('policy_key,policy_version')
            .eq('user_id',userId),
        ])
        if(documents.error)throw documents.error
        if(reviews.error)throw reviews.error
        if(active){setPolicies((documents.data??[]) as Policy[]);setReceipts((reviews.data??[]) as Receipt[])}
      }catch(e){if(active)setError(e instanceof Error?e.message:'Could not load policy records.')}
      finally{if(active)setLoading(false)}
    })()
    return()=>{active=false}
  },[userId,revision])

  const current=validKeys.map(key=>policies.find(policy=>policy.policy_key===key)).filter(Boolean) as Policy[]
  const reviewed=(policy:Policy)=>receipts.some(r=>r.policy_key===policy.policy_key&&r.policy_version===policy.version)
  const remaining=current.filter(p=>!reviewed(p))
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault()
    if(current.length!==2||remaining.length===0||remaining.some(p=>!checked[p.policy_key as Key]))return
    setBusy(true);setError('');setNotice('')
    try{
      const {data:auth,error:authError}=await supabase.auth.getUser()
      if(authError||auth.user?.id!==userId)throw new Error('Please sign in again.')
      const {error:writeError}=await supabase.from('policy_summary_review_receipts')
        .insert(remaining.map(p=>({user_id:userId,policy_key:p.policy_key,policy_version:p.version,review_kind:'draft_summary'})))
      if(writeError)throw writeError
      setChecked({terms:false,privacy:false})
      setNotice('Your draft-summary review was recorded. This is not final Terms acceptance or legal/privacy consent.')
      setRevision(v=>v+1)
    }catch(err){setError(err instanceof Error?err.message:'Could not record your review.')}
    finally{setBusy(false)}
  }

  return <section className="list-panel" aria-label="My policy review records">
    <h2>Terms and privacy: review your records</h2>
    <p>These are <strong>draft, plain-language summaries</strong>, not MELA's complete legally reviewed Terms of Service or Privacy Notice. Reading or confirming them never replaces an independently verified guardian decision or a future final-policy acceptance.</p>
    {notice&&<p className="banner banner-info" role="status">{notice}</p>}
    {error&&<p className="banner banner-error" role="alert">{error}</p>}
    {loading?<p role="status">Loading current policy versions…</p>:current.length!==2?
      <p role="alert">The required policy records are unavailable. Your review cannot be recorded until MELA publishes both required policy versions.</p>:
      <form onSubmit={e=>void submit(e)}>
        {current.map(policy=>{
          const key=policy.policy_key as Key
          const done=reviewed(policy)
          return <section key={key} className="list-panel">
            <h3>{policy.title}</h3>
            <p>Database policy version: {policy.version} · Draft-summary review: {done?'recorded':'not recorded'}</p>
            <details><summary>Read draft {key==='terms'?'Terms':'Privacy'} summary</summary>
              <ul>{summaries[key].map(text=><li key={text}>{text}</li>)}</ul>
            </details>
            {!done&&<label htmlFor={'policy-draft-'+key}>
              <input id={'policy-draft-'+key} type="checkbox" disabled={busy} checked={checked[key]} onChange={e=>setChecked(v=>({...v,[key]:e.target.checked}))}/>
              {' '}I have read this draft {key==='terms'?'Terms':'Privacy'} summary and understand it is not the final approved legal document.
            </label>}
          </section>
        })}
        {remaining.length>0?<button type="submit" className="btn btn-secondary" disabled={busy||remaining.some(p=>!checked[p.policy_key as Key])}>
          {busy?'Recording review…':'Record my draft-summary review'}</button>:
          <p role="status">Both draft summaries have been reviewed for the currently displayed database versions.</p>}
      </form>}
    <p className="field-hint">Final legal acceptance remains pending publication and qualified legal/safeguarding review. This panel does not write to the separate Terms/Privacy acceptance ledger.</p>
  </section>
}
