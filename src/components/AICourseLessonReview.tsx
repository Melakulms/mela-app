import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import LessonText from './LessonText'

type Item={lesson_key:string;course_title:string;title:string;position:number;review_status:string;content_version:string}
type Detail={lesson:{lesson_key:string;content_version:string;content_text:string};answer_key:{question:string;model_answer:string;marking_notes:string}}
const message=(e:unknown)=>e&&typeof e==='object'&&'message' in e?String(e.message):'Review request failed. Please retry.'
export default function AICourseLessonReview(){
 const [items,setItems]=useState<Item[]>([]),[detail,setDetail]=useState<Detail|null>(null)
 const [course,setCourse]=useState(''),[attempt,setAttempt]=useState(''),[note,setNote]=useState(''),[decision,setDecision]=useState('')
 const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[revision,setRevision]=useState(0)
 const lock=useRef(false)
 useEffect(()=>{let active=true;setBusy(true);setError('');void(async()=>{try{const {data,error}=await supabase.rpc('get_ai_lesson_review_queue_v1');if(error)throw error;if(active)setItems(data??[])}catch(e){if(active)setError(message(e))}finally{if(active)setBusy(false)}})();return()=>{active=false}},[revision])
 const open=async(key:string)=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');setSuccess('');setDetail(null);try{const {data,error}=await supabase.rpc('get_ai_lesson_review_detail_v1',{p_lesson_key:key});if(error)throw error;setDetail(data);setAttempt('');setNote('');setDecision('');setChecked(false)}catch(e){setError(message(e))}finally{lock.current=false;setBusy(false)}}
 const save=async(e:React.FormEvent)=>{e.preventDefault();if(!detail||lock.current||!checked||!attempt.trim()||note.trim().length<5||!decision)return;lock.current=true;setBusy(true);setError('');try{const {error}=await supabase.rpc('review_ai_lesson_v1',{p_lesson_key:detail.lesson.lesson_key,p_content_version:detail.lesson.content_version,p_decision:decision,p_attempt:attempt.trim(),p_note:note.trim(),p_checked:checked});if(error)throw error;setSuccess('Your lesson review was saved with its version and audit history.');setDetail(null);setRevision(v=>v+1)}catch(e){setError(message(e))}finally{lock.current=false;setBusy(false)}}
 return <section aria-label="AI course lesson review"><h2>AI course lesson review</h2>
 <p>Review the prepared course lessons separately from the school question bank. Your administrator must verify your teacher profile and assign the courses you are qualified to review.</p>
 {error&&<p role="alert">{error}</p>}{success&&<p role="status">{success}</p>}
 <button className="btn btn-secondary" disabled={busy} onClick={()=>setRevision(v=>v+1)}>Refresh course assignments</button>
 {busy&&<p role="status">Loading or saving course review…</p>}
 {!detail&&!busy&&<>
 {!items.length?<p>No AI course review assignments are active for this account.</p>:<><label htmlFor="ai-review-course">Course assignment</label><select id="ai-review-course" value={course} onChange={e=>setCourse(e.target.value)}><option value="">All assigned courses</option>{[...new Set(items.map(i=>i.course_title))].map(c=><option key={c}>{c}</option>)}</select>
 <div className="list-panel">{items.filter(i=>!course||i.course_title===course).map(i=><div className="list-row" key={i.lesson_key}><div><strong>{i.course_title} · Lesson {i.position}</strong><p>{i.title} · {i.review_status.replaceAll('_',' ')}</p></div><button className="btn btn-secondary" onClick={()=>void open(i.lesson_key)}>Review lesson</button></div>)}</div></>}
 </>}
 {detail&&<form onSubmit={save}><button type="button" className="btn btn-secondary" disabled={busy} onClick={()=>setDetail(null)}>Back to assigned lessons</button><LessonText text={detail.lesson.content_text}/>
 <h3>Teacher assessment</h3><p>{detail.answer_key.question}</p>
 <label htmlFor="ai-review-attempt">Your independent answer or test result</label><textarea id="ai-review-attempt" required maxLength={4000} disabled={busy} value={attempt} onChange={e=>{setAttempt(e.target.value);setChecked(false)}}/>
 {attempt.trim()&&<details><summary>Show teacher answer guidance</summary><pre className="review-data">{detail.answer_key.model_answer}</pre><p>{detail.answer_key.marking_notes}</p></details>}
 <label><input type="checkbox" checked={checked} disabled={busy||!attempt.trim()} onChange={e=>setChecked(e.target.checked)}/> I checked accuracy, assessment answers, age suitability, language, safety and accessibility myself.</label>
 <label htmlFor="ai-review-decision">Lesson decision</label><select id="ai-review-decision" required disabled={busy} value={decision} onChange={e=>setDecision(e.target.value)}><option value="">Choose</option><option value="approved">Approve</option><option value="changes_required">Changes required</option></select>
 <label htmlFor="ai-review-note">Review evidence and correction note</label><textarea id="ai-review-note" required minLength={5} maxLength={4000} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/>
 <button className="btn btn-primary" disabled={busy||!checked||!attempt.trim()||note.trim().length<5||!decision}>Save lesson review</button>
 </form>}
 </section>
}
