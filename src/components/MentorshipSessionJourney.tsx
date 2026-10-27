import { useEffect,useRef,useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MentorshipSession } from '../lib/mentorship'

type Preparation={
 id:string;session_id:string;goal:string;questions:string;updated_at:string
}
type Reflection={
 id:string;session_id:string;learning_summary:string;next_step:string;created_at:string
}

export default function MentorshipSessionJourney({sessions}:{sessions:MentorshipSession[]}) {
 const eligible=sessions.filter(s=>s.status==='scheduled'||s.status==='completed')
 const [selected,setSelected]=useState('')
 const [preparations,setPreparations]=useState<Preparation[]>([])
 const [reflections,setReflections]=useState<Reflection[]>([])
 const [goal,setGoal]=useState('')
 const [questions,setQuestions]=useState('')
 const [learning,setLearning]=useState('')
 const [nextStep,setNextStep]=useState('')
 const [loading,setLoading]=useState(true)
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [revision,setRevision]=useState(0)
 const lock=useRef(false)
 const keys=eligible.map(s=>s.id).join(',')
 const current=eligible.find(s=>s.id===selected)??null
 const preparation=preparations.find(p=>p.session_id===current?.id)
 const reflection=reflections.find(p=>p.session_id===current?.id)

 useEffect(()=>{
  let active=true
  setLoading(true);setError('')
  void (async()=>{
   try{
    const ids=keys.split(',').filter(Boolean)
    if(!ids.length){
      if(active){setPreparations([]);setReflections([])}
      return
    }
    const {data:auth,error:authError}=await supabase.auth.getUser()
    if(authError)throw new Error(authError.message)
    if(!auth.user)throw new Error('Sign in to view your private mentorship session plan.')
    const [prep,refl]=await Promise.all([
      supabase.from('mentorship_session_preparations')
        .select('id,session_id,goal,questions,updated_at')
        .eq('learner_id',auth.user.id).in('session_id',ids),
      supabase.from('mentorship_session_reflections')
        .select('id,session_id,learning_summary,next_step,created_at')
        .eq('learner_id',auth.user.id).in('session_id',ids),
    ])
    if(prep.error)throw new Error(prep.error.message)
    if(refl.error)throw new Error(refl.error.message)
    if(active){
      setPreparations((prep.data??[]) as Preparation[])
      setReflections((refl.data??[]) as Reflection[])
    }
   }catch(cause){
    if(active)setError(cause instanceof Error?cause.message:'Unable to load private session preparation.')
   }finally{if(active)setLoading(false)}
  })()
  return()=>{active=false}
 },[keys,revision])

 useEffect(()=>{
  const savedPrep=preparations.find(p=>p.session_id===selected)
  const savedRefl=reflections.find(p=>p.session_id===selected)
  setGoal(savedPrep?.goal??'')
  setQuestions(savedPrep?.questions??'')
  setLearning(savedRefl?.learning_summary??'')
  setNextStep(savedRefl?.next_step??'')
 },[selected,preparations,reflections])

 const run=async(work:()=>Promise<void>,message:string)=>{
  if(lock.current)return
  lock.current=true;setBusy(true);setError('');setNotice('')
  try{await work();setNotice(message);setRevision(n=>n+1)}
  catch(cause){setError(cause instanceof Error?cause.message:'Could not save your private session notes.')}
  finally{lock.current=false;setBusy(false)}
 }

 const savePreparation=(event:React.FormEvent)=>{
  event.preventDefault()
  if(!current||goal.trim().length<3||questions.trim().length<10)return
  void run(async()=>{
    if(preparation){
      const {data,error:updateError}=await supabase.from('mentorship_session_preparations')
        .update({goal:goal.trim(),questions:questions.trim()})
        .eq('id',preparation.id).select('id')
      if(updateError)throw new Error(updateError.message)
      if(!data?.length)throw new Error('Private preparation was not updated; check your access.')
    }else{
      const {data:auth,error:authError}=await supabase.auth.getUser()
      if(authError)throw new Error(authError.message)
      if(!auth.user)throw new Error('Please sign in again.')
      const {error:insertError}=await supabase.from('mentorship_session_preparations').insert({
        session_id:current.id,learner_id:auth.user.id,
        goal:goal.trim(),questions:questions.trim(),
      })
      if(insertError)throw new Error(insertError.message)
    }
  },'Your private session preparation was saved.')
 }

 const saveReflection=(event:React.FormEvent)=>{
  event.preventDefault()
  if(!current||current.status!=='completed'||reflection ||
    learning.trim().length<10||nextStep.trim().length<3)return
  void run(async()=>{
    const {data:auth,error:authError}=await supabase.auth.getUser()
    if(authError)throw new Error(authError.message)
    if(!auth.user)throw new Error('Please sign in again.')
    const {error:insertError}=await supabase.from('mentorship_session_reflections').insert({
      session_id:current.id,learner_id:auth.user.id,
      learning_summary:learning.trim(),next_step:nextStep.trim(),
    })
    if(insertError)throw new Error(insertError.message)
  },'Your private reflection was saved. It does not issue a certificate or verified achievement.')
 }

 return <section id="mentorship-session-journey" className="empty-panel" style={{textAlign:'left'}}
     aria-label="Private mentorship session preparation and reflection">
   <h2>My session preparation and reflection</h2>
   <p>Prepare questions before an approved appointment and record what you learned afterward. Notes are private to your account, and reflections are self-reported rather than verified credentials.</p>
   {error&&<p role="alert" className="banner banner-error">{error}</p>}
   {notice&&<p role="status" className="banner banner-info">{notice}</p>}
   {eligible.length===0?<p className="muted">No confirmed or completed sessions yet. When a verified mentor schedules your appointment, preparation tools will appear here.</p>:
     <>
       <div className="field"><label htmlFor="mentorship-session-plan">Select session</label>
         <select id="mentorship-session-plan" value={selected} disabled={busy||loading}
           onChange={event=>setSelected(event.target.value)}>
           <option value="">Choose a confirmed or completed session</option>
           {eligible.map(item=><option key={item.id} value={item.id}>
             {new Date(item.scheduled_at).toLocaleString()} · {item.status}
           </option>)}
         </select>
       </div>
       {loading?<p role="status">Loading private session notes…</p>:current&&<>
         <form onSubmit={savePreparation}>
           <h3>Prepare for this session</h3>
           <div className="field"><label htmlFor="mentorship-session-goal">Session goal</label>
             <input id="mentorship-session-goal" value={goal} minLength={3} maxLength={300}
               required disabled={busy} onChange={event=>setGoal(event.target.value)}
               placeholder="e.g. Prepare for a scholarship interview"/>
           </div>
           <div className="field"><label htmlFor="mentorship-session-questions">My discussion questions or topics</label>
             <textarea id="mentorship-session-questions" value={questions} minLength={10} maxLength={3000}
               rows={4} required disabled={busy} onChange={event=>setQuestions(event.target.value)}/>
           </div>
           <button type="submit" className="btn btn-primary"
             disabled={busy||goal.trim().length<3||questions.trim().length<10}>
             {busy?'Saving…':preparation?'Update my private preparation':'Save my preparation'}
           </button>
         </form>
         {current.status==='completed'&&<section>
           <h3>Reflect on your completed session</h3>
           {reflection?<div>
             <p><strong>What I learned:</strong> {reflection.learning_summary}</p>
             <p><strong>My next step:</strong> {reflection.next_step}</p>
             <p className="muted">Recorded {new Date(reflection.created_at).toLocaleDateString()}.
               This reflection is not a verified learning award.</p>
           </div>:<form onSubmit={saveReflection}>
             <div className="field"><label htmlFor="mentorship-session-learning">What I learned</label>
               <textarea id="mentorship-session-learning" value={learning} minLength={10} maxLength={3000}
                 rows={4} required disabled={busy} onChange={event=>setLearning(event.target.value)}/>
             </div>
             <div className="field"><label htmlFor="mentorship-session-next-step">My next practical step</label>
               <textarea id="mentorship-session-next-step" value={nextStep} minLength={3} maxLength={1000}
                 rows={2} required disabled={busy} onChange={event=>setNextStep(event.target.value)}/>
             </div>
             <button type="submit" className="btn btn-primary"
               disabled={busy||learning.trim().length<10||nextStep.trim().length<3}>
               {busy?'Saving…':'Save self-reported reflection'}
             </button>
           </form>}
         </section>}
       </>}
     </>}
 </section>
}
