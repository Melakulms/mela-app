import { useEffect,useRef,useState } from 'react'
import { supabase } from '../lib/supabase'
import MentorshipSafetyReporting from './MentorshipSafetyReporting'
import type { MentorshipSession,MyMentorshipRequest } from '../lib/mentorship'

type ReportableRequest=Pick<MyMentorshipRequest,'id'|'topic'>
type ReportableSession=Pick<MentorshipSession,'id'|'scheduled_at'|'status'>

export default function MentorshipMentorSafetyReporting() {
  const [requests,setRequests]=useState<ReportableRequest[]>([])
  const [sessions,setSessions]=useState<ReportableSession[]>([])
  const [error,setError]=useState('')
  const [loading,setLoading]=useState(true)
  const [revision,setRevision]=useState(0)
  const accountEpoch=useRef(0)
  useEffect(()=>{
    const clear=()=>{
      accountEpoch.current+=1
      setRequests([]);setSessions([]);setError('');setLoading(true)
      setRevision(n=>n+1)
    }
    window.addEventListener('mela:session-boundary',clear)
    return()=>{accountEpoch.current+=1;window.removeEventListener('mela:session-boundary',clear)}
  },[])
  useEffect(()=>{
    let active=true;const epoch=accountEpoch.current;setError('');setLoading(true)
    void (async()=>{
      try{
        const {data:auth,error:authError}=await supabase.auth.getUser()
        if(authError)throw new Error(authError.message)
        if(!auth.user)throw new Error('Sign in to use the mentor safety pathway.')
        const userId=auth.user.id
        const [req,session]=await Promise.all([
          supabase.from('mentorship_requests').select('id,topic')
            .eq('mentor_id',userId).order('created_at',{ascending:false}).limit(100),
          supabase.from('mentorship_sessions').select('id,scheduled_at,status')
            .eq('mentor_id',userId).order('scheduled_at',{ascending:false}).limit(100),
        ])
        if(req.error)throw new Error(req.error.message)
        if(session.error)throw new Error(session.error.message)
        if(active&&epoch===accountEpoch.current){
          setRequests((req.data??[]) as ReportableRequest[])
          setSessions((session.data??[]) as ReportableSession[])
        }
      }catch(cause){
        if(active&&epoch===accountEpoch.current)setError(cause instanceof Error?cause.message:'Could not load mentor safety participation.')
      }finally{if(active&&epoch===accountEpoch.current)setLoading(false)}
    })()
    return()=>{active=false}
  },[revision])
  return <section aria-label="Mentor and educator safety reporting">
    {loading?<p role="status">Checking mentor safety reporting access…</p>
      :error?<p role="alert" className="banner banner-error">
          {error} <button type="button" onClick={()=>setRevision(n=>n+1)}>Retry</button>
        </p>
      :<MentorshipSafetyReporting mentors={[]} requests={requests} sessions={sessions}/>}
  </section>
}
