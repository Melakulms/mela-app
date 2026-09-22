import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type View = 'challenges' | 'assessments' | 'earn'
export default function LearnerSubsections({view,onBack}:{view:View;onBack:()=>void}) {
 const [rows,setRows]=useState<any[]>([]),[mine,setMine]=useState<any[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 useEffect(()=>{(async()=>{
  setLoading(true);setError('')
  try {
   if(view==='challenges'){
    const {data,error}=await supabase.from('sponsored_challenges').select('id,sponsor_name,title,description,prize_amount_etb,starts_at,ends_at,status,challenge_type,team_mode').in('status',['published','active']).order('starts_at',{ascending:true})
    if(error) throw error
    setRows(data??[])
    const {data:cp}=await supabase.from('challenge_participants').select('challenge_id,status,joined_at').order('joined_at',{ascending:false}); setMine(cp??[])
   } else if(view==='assessments'){
    const {data,error}=await supabase.from('skill_assessments').select('id,title,description,duration_minutes,pass_score,question_count,is_proctored,status').eq('status','published').order('created_at',{ascending:false})
    if(error) throw error; setRows(data??[])
    const {data:sr}=await supabase.from('skill_assessment_results').select('id,score,level,created_at').order('created_at',{ascending:false}); setMine(sr??[])
   } else {
    const {data,error}=await supabase.from('marketplace_tasks').select('id,title,description,task_type,budget_amount,currency,reward_coins,deadline,status,skills_required').in('status',['open','published']).order('deadline',{ascending:true})
    if(error) throw error; setRows(data??[])
    const {data:assigned}=await supabase.from('marketplace_tasks').select('id,title,status,budget_amount,currency,deadline').not('assigned_to','is',null).order('updated_at',{ascending:false}); setMine(assigned??[])
   }
  }catch(e:any){setError(e.message??'Could not load this section.')}finally{setLoading(false)}
 })()},[view])
 const title=view==='challenges'?'Sponsored Challenges':view==='assessments'?'Verified Assessments':'Earn & Work'
 return <div className="dash-main">
  <div className="section-heading"><h1>{title}</h1><button className="btn btn-secondary" onClick={onBack}>Back</button></div>
  {error&&<div className="banner banner-error">{error}</div>}
  {loading?<div className="centered-loading">Loading {title}…</div>:<>
   <div className="section-heading"><h2>{view==='assessments'?'Published assessments':view==='challenges'?'Open challenges':'Available work'}</h2></div>
   {rows.length===0?<div className="empty-panel">Nothing is available in this section right now. Check back after content is published.</div>:
    <div className="list-panel">{rows.map(x=><div className="list-row" key={x.id}><div><div className="list-row-title">{x.title}</div><div className="list-row-meta">
      {view==='challenges'?`${x.sponsor_name??'MELA'} · ${x.challenge_type??'challenge'} · ${x.prize_amount_etb??0} ETB · ${x.status}`:view==='assessments'?`${x.question_count??0} questions · ${x.duration_minutes??0} min · pass ${x.pass_score??0}%`: `${x.task_type??'task'} · ${x.budget_amount??x.reward_coins??0} ${x.currency??'ETB'} · deadline ${x.deadline??'—'}`}</div>
      {x.description&&<p className="muted">{x.description}</p>}</div><span className="pill">{view==='challenges'?(mine.some(m=>m.challenge_id===x.id)?'Joined':'Open'):view==='assessments'?'Available':x.status}</span></div>)}</div>}
   {mine.length>0&&<><div className="section-heading"><h2>{view==='assessments'?'My results':'My activity'}</h2></div><div className="list-panel">{mine.slice(0,10).map((x,i)=><div className="list-row" key={x.id??i}><span className="list-row-title">{x.title??x.level??'Activity'}</span><span className="pill">{x.status??x.score??''}</span></div>)}</div></>}
  </>}
 </div>
}
