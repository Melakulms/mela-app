import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import LessonText from './LessonText'
import type { Course } from '../lib/academy'

type Lesson = {lesson_key:string; title:string; position:number; content_text:string; duration_minutes:number; review_status:string}
export default function PreparedCourseReader({course,onBack}:{course:Course;onBack:()=>void}) {
 const [lessons,setLessons]=useState<Lesson[]>([])
 const [index,setIndex]=useState(0)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [revision,setRevision]=useState(0)
 useEffect(()=>{
  let active=true;setLoading(true);setError('');setLessons([]);setIndex(0)
  void (async()=>{
   try {
    const {data,error}=await supabase.from('mela_ai_course_lessons').select('lesson_key,title,position,content_text,duration_minutes,review_status').eq('course_id',course.id).order('position')
    if(error)throw error
    if(active)setLessons(data??[])
   } catch(e){if(active)setError(e instanceof Error?e.message:'Could not load prepared lessons. Please retry.')}
   finally{if(active)setLoading(false)}
  })()
  return ()=>{active=false}
 },[course.id,revision])
 const lesson=lessons[index]
 return <section className="dash-main" aria-label="Prepared AI course lessons">
  <button className="btn btn-secondary" onClick={onBack}>Back to courses</button>
  <h1>{course.title}</h1>
  <p className="banner banner-info">Prepared English lessons · Teacher review in progress. These study drafts do not award certificates or record completion of the existing course.</p>
  {loading&&<p role="status">Loading course content…</p>}
  {error&&<div role="alert">{error}<button className="btn btn-secondary" onClick={()=>setRevision(x=>x+1)}>Retry prepared lessons</button></div>}
  {!loading&&!error&&!lessons.length&&<p>No prepared lessons are available for this account yet.</p>}
  {lesson&&<>
   <label htmlFor="prepared-lesson">Choose a lesson</label>
   <select id="prepared-lesson" value={index} onChange={e=>setIndex(Number(e.target.value))}>{lessons.map((l,i)=><option key={l.lesson_key} value={i}>{i+1}. {l.title}</option>)}</select>
   <p role="status">Lesson {index+1} of {lessons.length} · {lesson.duration_minutes} minutes · {lesson.review_status==='approved'?'Teacher-reviewed':lesson.review_status==='changes_required'?'Teacher requested corrections':'Awaiting teacher review'}</p>
   <article key={lesson.lesson_key}><LessonText text={lesson.content_text}/></article>
   <div className="toolbar"><button className="btn btn-secondary" disabled={index===0} onClick={()=>setIndex(i=>i-1)}>Previous lesson</button><button className="btn btn-primary" disabled={index===lessons.length-1} onClick={()=>setIndex(i=>i+1)}>Next lesson</button></div>
  </>}
 </section>
}
