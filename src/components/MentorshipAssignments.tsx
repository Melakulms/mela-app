import { useEffect, useRef, useState } from 'react'
import {
  assignmentDueIso, createAssignment, loadAssignmentWorkspace,
  reviewAssignment, submitAssignment,
  type AcceptedMentorship, type AssignmentRole, type AssignmentWorkspace, type MelaAssignment,
} from '../lib/mentorship-assignments'

const draftFeedback='Strength: [specific observed work]. Improve: [concrete suggestion]. Next step: [action].'

export default function MentorshipAssignments({role}:{role:AssignmentRole}) {
  const [workspace,setWorkspace]=useState<AssignmentWorkspace|null>(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [revision,setRevision]=useState(0)
  const [busy,setBusy]=useState(false)
  const lock=useRef(false)
  const [requestId,setRequestId]=useState('')
  const [title,setTitle]=useState('')
  const [instructions,setInstructions]=useState('')
  const [dueLocal,setDueLocal]=useState('')
  const [answers,setAnswers]=useState<Record<string,string>>({})
  const [reviews,setReviews]=useState<Record<string,string>>({})
  const [filter,setFilter]=useState<'all'|'pending'|'review'|'completed'>('all')

  useEffect(()=>{
    const forget=()=>{
      setWorkspace(null);setAnswers({});setReviews({});setRequestId('');
      setTitle('');setInstructions('');setDueLocal('');setError('');setNotice('');
    }
    window.addEventListener('mela:session-boundary',forget)
    return()=>window.removeEventListener('mela:session-boundary',forget)
  },[])
  useEffect(()=>{
    let active=true
    setLoading(true);setWorkspace(null);setError('');setNotice('')
    setAnswers({});setReviews({});setRequestId('')
    setTitle('');setInstructions('');setDueLocal('')
    void loadAssignmentWorkspace(role)
      .then(result=>{if(active)setWorkspace(result)})
      .catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'Assignments cannot load.')})
      .finally(()=>{if(active)setLoading(false)})
    return()=>{active=false}
  },[role,revision])

  const mutate=async (operation:()=>Promise<void>,success:string)=>{
    if(lock.current)return
    lock.current=true;setBusy(true);setError('');setNotice('')
    try{
      await operation()
      setNotice(success)
      // Reset only after the server confirms success.
      setRevision(value=>value+1)
    }catch(reason){
      setError(reason instanceof Error?reason.message:'Could not save. Your draft is unchanged.')
    }finally{lock.current=false;setBusy(false)}
  }

  const selected=workspace?.accepted.find(row=>row.id===requestId)
  const submitNew=(event:React.FormEvent)=>{
    event.preventDefault()
    if(!selected){setError('Choose an accepted mentor–learner request.');return}
    void mutate(()=>createAssignment(selected,title,instructions,dueLocal),'Task assigned securely.')
  }
  const revise=(task:MelaAssignment,feedbackText:string)=>{
    const relation=workspace?.accepted.find(row=>row.id===task.request_id&&row.mentee_id===task.learner_id)
    if(!relation){setError('This accepted mentor–learner relationship is unavailable.');return}
    setRequestId(relation.id)
    setTitle(('Revision: '+task.title).slice(0,160))
    setInstructions(('Improve the earlier response; describe what you changed.\n\nMentor feedback: '+feedbackText+
      '\n\nEarlier task: '+task.instructions).slice(0,4000))
    setDueLocal('')
    setNotice('Follow-up draft prepared above. It has not been sent; review it and select Assign task.')
    document.getElementById('mela-assignment-relationship')?.focus()
  }
  const submitted=new Map((workspace?.submissions||[]).map(item=>[item.assignment_id,item]))
  const reviewed=new Map((workspace?.feedback||[]).map(item=>[item.assignment_id,item]))
  const all=workspace?.assignments||[]
  const shown=all.filter(task=>{
    const answer=submitted.has(task.id),feedback=reviewed.has(task.id)
    if(filter==='pending')return !answer
    if(filter==='review')return answer&&!feedback
    if(filter==='completed')return answer&&feedback
    return true
  })
  const overdue=all.filter(item=>!submitted.has(item.id)&&item.due_at&&Date.parse(item.due_at)<Date.now()).length
  const invalidDue=!!dueLocal&&(()=>{try{assignmentDueIso(dueLocal);return false}catch{return true}})()

  return <section className="empty-panel" style={{textAlign:'left'}} aria-label="MELA mentorship assignments" id="mentorship-assignments">
    <div className="section-heading"><h2>Assignments and feedback</h2>
      <button type="button" className="btn btn-secondary" disabled={busy||loading}
        onClick={()=>setRevision(value=>value+1)}>Refresh assignments</button>
    </div>
    <p>{role==='mentor'
      ? 'Create learning tasks for accepted mentees, review their responses and prepare follow-up revisions.'
      : 'See tasks from your approved mentor, submit your work once and read constructive feedback.'}
      {' '}These activities are private and are not certificates or verified qualifications.</p>
    {error&&<div className="banner banner-error" role="alert">{error}</div>}
    {notice&&<p className="banner banner-info" role="status">{notice}</p>}
    {loading&&<p role="status">Loading assignments…</p>}
    {!loading&&workspace&&<>
      {role==='mentor'&&<form onSubmit={submitNew} aria-label="New mentorship assignment">
        <div className="field"><label htmlFor="mela-assignment-relationship">Accepted mentorship</label>
          <select id="mela-assignment-relationship" value={requestId} required disabled={busy}
            onChange={event=>setRequestId(event.target.value)}>
            <option value="">Choose accepted request</option>
            {workspace.accepted.map(row=><option value={row.id} key={row.id}>
              {row.topic||'Mentorship'} · {row.id.slice(0,8)}
            </option>)}
          </select>
        </div>
        {workspace.accepted.length===0&&<p className="muted">No accepted, eligible learner relationships are currently available for new tasks.</p>}
        <div className="field"><label htmlFor="mela-task-title">Title</label>
          <input id="mela-task-title" value={title} minLength={3} maxLength={160} required disabled={busy}
            onChange={event=>setTitle(event.target.value)}/></div>
        <div className="field"><label htmlFor="mela-task-instructions">Instructions</label>
          <textarea id="mela-task-instructions" rows={4} value={instructions} minLength={10} maxLength={4000} required disabled={busy}
            onChange={event=>setInstructions(event.target.value)}/></div>
        <div className="field"><label htmlFor="mela-task-deadline">Optional due date</label>
          <input id="mela-task-deadline" type="datetime-local" value={dueLocal} disabled={busy}
            onChange={event=>setDueLocal(event.target.value)}/>
          {invalidDue&&<p role="status">Choose a future date or leave it blank.</p>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy||!selected||invalidDue||title.trim().length<3||instructions.trim().length<10}>Assign task</button>
        <p className="muted">Nothing is sent until you select Assign task. A revision creates a new task, preserving the original.</p>
      </form>}
      <p role="status">
        {all.length} assignments · {workspace.submissions.length} responses · {workspace.feedback.length} reviews
        {overdue>0?' · '+overdue+' past due':''}
      </p>
      {all.length>0&&<div className="field">
        <label htmlFor="mela-assignment-status-filter">Filter assignments</label>
        <select id="mela-assignment-status-filter" value={filter}
          onChange={event=>setFilter(event.target.value as typeof filter)}>
          <option value="all">All tasks</option>
          <option value="pending">Awaiting response</option>
          <option value="review">Awaiting mentor feedback</option>
          <option value="completed">Feedback recorded</option>
        </select>
      </div>}
      {all.length===0?<p className="muted">No assignments yet.</p>
        :shown.length===0?<p className="muted">No assignments match this filter.</p>
        :<div className="list-panel">{shown.map(task=>{
          const response=submitted.get(task.id),feedback=reviewed.get(task.id)
          const canRevise=role==='mentor'&&feedback&&workspace.accepted.some(r=>r.id===task.request_id&&r.mentee_id===task.learner_id)
          return <article className="list-row" key={task.id} style={{display:'block'}}>
            <h3>{task.title}</h3>
            <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{task.instructions}</p>
            {task.due_at&&<p className="muted">Due: {new Date(task.due_at).toLocaleString()}
              {!response&&Date.parse(task.due_at)<Date.now()?' · past due':''}</p>}
            {response?<div><strong>Learner response</strong>
              <p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{response.response}</p></div>
              :role==='learner'?<div className="field"><label htmlFor={'mela-task-response-'+task.id}>Your response</label>
                <textarea id={'mela-task-response-'+task.id} rows={4} maxLength={4000} disabled={busy}
                  value={answers[task.id]||''} onChange={event=>setAnswers(current=>({...current,[task.id]:event.target.value}))}/>
                <button type="button" className="btn btn-primary"
                  disabled={busy||(answers[task.id]||'').trim().length<2}
                  onClick={()=>void mutate(()=>submitAssignment(task.id,answers[task.id]||''),'Your response was submitted.')}>Submit response</button>
              </div>:<p className="muted">Awaiting learner response.</p>}
            {feedback&&<p style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}><strong>Mentor feedback:</strong> {feedback.feedback}</p>}
            {role==='mentor'&&response&&!feedback&&<div className="field">
              <label htmlFor={'mela-task-feedback-'+task.id}>Your review</label>
              <button type="button" className="btn btn-secondary" disabled={busy}
                onClick={()=>setReviews(current=>({...current,[task.id]:draftFeedback}))}>Use feedback outline</button>
              <textarea id={'mela-task-feedback-'+task.id} rows={4} maxLength={4000} disabled={busy}
                value={reviews[task.id]||''} onChange={event=>setReviews(current=>({...current,[task.id]:event.target.value}))}/>
              <button type="button" className="btn btn-primary" disabled={busy||(reviews[task.id]||'').trim().length<2||/\[[^\]]+\]/.test(reviews[task.id]||'')}
                onClick={()=>void mutate(()=>reviewAssignment(task.id,reviews[task.id]||''),'Your feedback was saved.')}>Send feedback</button>
            </div>}
            {canRevise&&<button type="button" className="btn btn-secondary" disabled={busy}
              onClick={()=>revise(task,feedback.feedback)}>Prepare revision task</button>}
          </article>
        })}</div>}
    </>}
  </section>
}
