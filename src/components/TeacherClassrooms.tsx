import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import EducatorObservationForm from './EducatorObservationForm'

type Room = {id:string;title:string;stage_key:string;subject:string|null;join_code:string;active:boolean}
type Learner = {id:string;full_name:string;grade_level:number|null;mastery:{overall_score:number|null;evidence_count:number}}
export default function TeacherClassrooms({onChanged}:{onChanged:()=>void}) {
 const [rooms,setRooms]=useState<Room[]>([]),[stages,setStages]=useState<{stage_key:string;title:string}[]>([]),[verified,setVerified]=useState(false)
 const [title,setTitle]=useState(''),[stage,setStage]=useState(''),[subject,setSubject]=useState('')
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 const [loadError,setLoadError]=useState(''),[notice,setNotice]=useState('')
 const [detail,setDetail]=useState<{classroom:Room;learners:Learner[]}|null>(null)
 const [observing,setObserving]=useState<string|null>(null)
 const lock=useRef(false)
 useEffect(()=>{
  let active=true;setLoading(true);setLoadError('');setError('');setDetail(null);setObserving(null);setVerified(false)
  void(async()=>{try{
   const {data:auth,error:authError}=await supabase.auth.getUser()
   if(authError)throw authError
   if(!auth.user)throw new Error('Please sign in again.')
   const [r,e,s]=await Promise.all([
    supabase.from('educator_classrooms').select('id,title,stage_key,subject,join_code,active').eq('educator_id',auth.user.id).order('created_at',{ascending:false}),
    supabase.from('educator_profiles').select('verified,active').eq('user_id',auth.user.id).maybeSingle(),
    supabase.from('education_audience_stages').select('stage_key,title').order('display_order'),
   ])
   if(r.error)throw r.error;if(e.error)throw e.error;if(s.error)throw s.error
   if(active){setRooms(r.data??[]);setVerified(!!e.data?.verified&&!!e.data?.active);setStages(s.data??[])}
  }catch(cause:any){if(active)setLoadError(cause?.message??'Could not load classrooms.')}
  finally{if(active)setLoading(false)}})()
  return()=>{active=false}
 },[revision])
 const create=async(event:React.FormEvent)=>{
  event.preventDefault();if(lock.current||loading||loadError||!verified||!title.trim()||!stage)return
  lock.current=true;setBusy(true);setError('');setNotice('')
  try{const {error}=await supabase.rpc('create_my_classroom',{p_title:title.trim(),p_stage_key:stage,p_subject:subject.trim()||null});if(error)throw error;setTitle('');setSubject('');setNotice('Classroom created. Share the join code with your students.');setRevision(value=>value+1);onChanged()}
  catch(cause:any){setError(cause?.message??'Could not create your classroom.')}
  finally{lock.current=false;setBusy(false)}
 }
 const inspect=async(id:string)=>{
  if(lock.current||loading||loadError)return
  lock.current=true;setBusy(true);setError('');setDetail(null);setObserving(null)
  try{const {data,error}=await supabase.rpc('get_my_classroom_detail',{p_classroom_id:id});if(error)throw error;if(!data?.classroom)throw new Error('Classroom unavailable.');setDetail(data)}
  catch(cause:any){setError(cause?.message??'Could not load the classroom.')}
  finally{lock.current=false;setBusy(false)}
 }
 return <section><div className="section-heading"><h2>Your classrooms</h2><button className="btn btn-secondary" disabled={loading||busy} onClick={()=>setRevision(value=>value+1)}>Refresh classrooms</button></div>
 {notice&&<div className="banner banner-info" role="status">{notice}</div>}
 {error&&<div className="banner banner-error" role="alert">{error}</div>}
 {loading?<p role="status">Loading classrooms…</p>:loadError?<div className="banner banner-error" role="alert">{loadError} Use Refresh classrooms to try again.</div>:<>
 {!rooms.length?<p>No classrooms yet.</p>:rooms.map(room=><div className="list-row" key={room.id}><div><strong>{room.title}</strong><p>{stages.find(item=>item.stage_key===room.stage_key)?.title??room.stage_key} · {room.subject??'General'} · {room.active?'Active':'Inactive'}</p>{room.active&&<p>Join code: <code>{room.join_code}</code></p>}</div><button className="btn btn-secondary" disabled={busy} onClick={()=>inspect(room.id)}>View learners</button></div>)}
 {detail&&<section><h3>{detail.classroom.title} — learners</h3>{detail.learners.length?detail.learners.map(learner=><div className="list-row" key={learner.id}><div><strong>{learner.full_name}</strong><div className="list-row-meta">Grade {learner.grade_level??'—'} · Mastery {learner.mastery?.overall_score??'Not recorded'} · {learner.mastery?.evidence_count??0} evidence records</div></div>{verified&&observing!==learner.id&&<button className="btn btn-secondary" disabled={busy} onClick={()=>setObserving(learner.id)}>Record observation</button>}{verified&&observing===learner.id&&<><EducatorObservationForm classroomId={detail.classroom.id} learnerId={learner.id} learnerName={learner.full_name} onSaved={()=>{setObserving(null);void inspect(detail.classroom.id);onChanged()}}/><button className="btn btn-secondary" type="button" onClick={()=>setObserving(null)}>Close observation</button></>}</div>):<p>No learners have joined yet.</p>}</section>}
 {verified?<form onSubmit={create}><h3>Create a classroom</h3><div className="field"><label htmlFor="class-title">Classroom title</label><input id="class-title" required maxLength={200} value={title} disabled={busy} onChange={e=>setTitle(e.target.value)}/></div><div className="field"><label htmlFor="class-stage">Education stage</label><select id="class-stage" required disabled={busy} value={stage} onChange={e=>setStage(e.target.value)}><option value="">Select stage</option>{stages.map(item=><option key={item.stage_key} value={item.stage_key}>{item.title}</option>)}</select></div><div className="field"><label htmlFor="class-subject">Subject</label><input id="class-subject" maxLength={100} disabled={busy} value={subject} onChange={e=>setSubject(e.target.value)}/></div><button className="btn btn-primary" disabled={busy||!title.trim()||!stage}>{busy?'Saving…':'Create classroom'}</button></form>:<p>Your school-linked educator profile must be verified and active before you can create classrooms.</p>}
 </>}
 </section>
}
