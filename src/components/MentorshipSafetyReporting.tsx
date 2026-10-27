import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Mentor, MentorshipSession, MyMentorshipRequest } from '../lib/mentorship'

type CaseStatus={id:string;reason:string;status:string;created_at:string}
type TargetKind='mentor_profile'|'mentorship_request'|'mentorship_session'
type Target={key:string;kind:TargetKind;id:string;name:string}

const REASONS=[
  'Unsafe or inappropriate communication',
  'Request for money or private credentials',
  'Harassment, discrimination or threats',
  'Mentor professional misconduct',
  'Guardian or child safeguarding concern',
  'Other mentorship safety concern',
] as const

export default function MentorshipSafetyReporting({
  mentors,requests,sessions
}:{
  mentors:Pick<Mentor,'user_id'|'full_name'|'headline'>[]
  requests:Pick<MyMentorshipRequest,'id'|'topic'>[]
  sessions:Pick<MentorshipSession,'id'|'scheduled_at'|'status'>[]
}) {
  const [targetKey,setTargetKey]=useState('')
  const [reason,setReason]=useState('')
  const [details,setDetails]=useState('')
  const [cases,setCases]=useState<CaseStatus[]>([])
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [revision,setRevision]=useState(0)
  const lock=useRef(false)
  const targets:Target[]=[
    ...mentors.map(m=>({
      key:'mentor_profile:'+m.user_id,kind:'mentor_profile' as const,
      id:m.user_id,name:'Mentor: '+(m.full_name||m.headline||'Verified MELA mentor'),
    })),
    ...requests.map(r=>({
      key:'mentorship_request:'+r.id,kind:'mentorship_request' as const,
      id:r.id,name:'Request: '+r.topic,
    })),
    ...sessions.map(s=>({
      key:'mentorship_session:'+s.id,kind:'mentorship_session' as const,
      id:s.id,name:'Session: '+new Date(s.scheduled_at).toLocaleString()+' ('+s.status+')',
    })),
  ]
  const chosen=targets.find(t=>t.key===targetKey)
  useEffect(()=>{
    let active=true;setLoading(true)
    void (async()=>{
      try{
        const {data:auth,error:authError}=await supabase.auth.getUser()
        if(authError)throw new Error(authError.message)
        if(!auth.user)throw new Error('Sign in to view your submitted safety concerns.')
        const {data,error:readError}=await supabase.from('reports')
          .select('id,reason,status,created_at').eq('reporter_id',auth.user.id)
          .in('target_type',['mentor_profile','mentorship_request','mentorship_session'])
          .order('created_at',{ascending:false}).limit(20)
        if(readError)throw new Error(readError.message)
        if(active)setCases((data??[]) as CaseStatus[])
      }catch(cause){
        if(active)setError(cause instanceof Error?cause.message:'Could not load safety report history.')
      }finally{if(active)setLoading(false)}
    })()
    return()=>{active=false}
  },[revision])

  const send=async(event:React.FormEvent)=>{
    event.preventDefault()
    if(lock.current||!chosen||!reason||details.trim().length<10)return
    lock.current=true;setBusy(true);setNotice('');setError('')
    try{
      const {data,error:rpcError}=await supabase.rpc('report_mentorship_concern',{
        p_target_type:chosen.kind,p_target_id:chosen.id,
        p_reason:reason,p_details:details.trim(),
      })
      if(rpcError)throw new Error(rpcError.message)
      if(typeof data!=='string'||!data)throw new Error('Report was not confirmed by the database.')
      setNotice('Your safety concern was submitted to MELA moderation. Case reference: '+data.slice(0,8)+'. This is not an emergency response service.')
      setTargetKey('');setReason('');setDetails('');setRevision(n=>n+1)
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Could not submit the safety concern.')
    }finally{lock.current=false;setBusy(false)}
  }
  return <section id="mentorship-reporting" className="empty-panel" style={{textAlign:'left'}} aria-label="Mentorship safety reporting">
    <h3>Report a mentorship safety concern</h3>
    <p>Report unsafe contact, harassment, requests for money, or inappropriate conduct. Reports go to the authorized MELA moderation process. Do not include passwords, account PINs, identity numbers or private documents.</p>
    <p className="muted">If anyone is in immediate danger, contact local emergency services or a trusted responsible adult. MELA safety reports are not monitored as an emergency hotline.</p>
    {error&&<p className="banner banner-error" role="alert">{error}</p>}
    {notice&&<p className="banner banner-info" role="status">{notice}</p>}
    {targets.length===0?<p className="muted">No mentor, mentorship request, or session is available to report here. Use the Safety Center for a general platform safety concern.</p>:
      <form onSubmit={send}>
        <div className="field"><label htmlFor="mentorship-concern-target">Who or what is involved?</label>
          <select id="mentorship-concern-target" value={targetKey} required disabled={busy} onChange={e=>setTargetKey(e.target.value)}>
            <option value="">Choose a mentor, request or session</option>
            {targets.map(t=><option key={t.key} value={t.key}>{t.name}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="mentorship-concern-reason">Concern</label>
          <select id="mentorship-concern-reason" value={reason} required disabled={busy} onChange={e=>setReason(e.target.value)}>
            <option value="">Select a reason</option>
            {REASONS.map(value=><option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="mentorship-concern-details">Describe what happened (10–4,000 characters)</label>
          <textarea id="mentorship-concern-details" value={details} minLength={10} maxLength={4000}
            disabled={busy} rows={4} required onChange={e=>setDetails(e.target.value)}/>
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy||!chosen||!reason||details.trim().length<10}>
          {busy?'Sending confidential report…':'Send confidential safety report'}
        </button>
      </form>}
    <h4>My previous mentorship reports</h4>
    {loading?<p role="status">Loading report status…</p>:
      cases.length===0?<p className="muted">No mentorship safety reports on this account.</p>:
      <ul>{cases.map(item=><li key={item.id}>
        <strong>{item.reason}</strong> · {item.status} · {new Date(item.created_at).toLocaleDateString()}
        <span className="muted"> · Case {item.id.slice(0,8)}</span>
      </li>)}</ul>}
    <button type="button" className="btn btn-secondary" disabled={busy||loading} onClick={()=>setRevision(n=>n+1)}>Refresh my report status</button>
  </section>
}
