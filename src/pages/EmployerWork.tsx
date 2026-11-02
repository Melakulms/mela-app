import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchMyMilestones, fetchMyReviews, submitContractReview, type Contract, type WorkMilestone, type WorkReview } from '../lib/contracts'

type WorkTask = {
  id:string; title:string; description:string|null; status:string; budget_amount:number|null;
  currency:string; deadline:string|null
}
type WorkBid = { id:string; task_id:string; user_id:string; status:string; proposal_text:string|null; proposed_amount:number|null; estimated_days:number|null }
type Panel = 'tasks'|'proposals'|'contracts'

function amountIsValid(value:string) {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number(value)>0 && Number(value)<=10000000
}

export default function EmployerWork({ employerId, onBack }: { employerId:string; onBack:()=>void }) {
  const [panel,setPanel] = useState<Panel>('tasks')
  const [tasks,setTasks] = useState<WorkTask[]>([])
  const [bids,setBids] = useState<WorkBid[]>([])
  const [contracts,setContracts] = useState<Contract[]>([])
  const [milestones,setMilestones] = useState<WorkMilestone[]>([])
  const [reviews,setReviews] = useState<WorkReview[]>([])
  const [ownId,setOwnId] = useState('')
  const [enabled,setEnabled] = useState(false)
  const [payoutsEnabled,setPayoutsEnabled] = useState(false)
  const [loading,setLoading] = useState(true)
  const [revision,setRevision] = useState(0)
  const [focused,setFocused] = useState<string|null>(null)
  const [error,setError] = useState('')
  const [notice,setNotice] = useState('')
  const [saving,setSaving] = useState(false)
  const [createTask,setCreateTask] = useState(false)
  const [title,setTitle] = useState('')
  const [description,setDescription] = useState('')
  const [budget,setBudget] = useState('')
  const [deadline,setDeadline] = useState('')
  const [terms,setTerms] = useState('')
  const [milestoneTitle,setMilestoneTitle] = useState('')
  const [milestoneAmount,setMilestoneAmount] = useState('')
  const [milestoneNote,setMilestoneNote] = useState('')
  const [rating,setRating] = useState('5')
  const [feedback,setFeedback] = useState('')
  const lock=useRef(false)

  useEffect(()=>{
    let active=true
    setLoading(true);setError('')
    void (async()=>{
      try {
        const [auth,readiness,taskResult,contractResult]=await Promise.all([
          supabase.auth.getUser(),
          supabase.rpc('mela_earn_work_readiness_v1'),
          supabase.from('marketplace_tasks').select('id,title,description,status,budget_amount,currency,deadline')
            .eq('employer_id',employerId).order('created_at',{ascending:false}).limit(100),
          supabase.from('freelance_contracts').select('id,task_id,freelancer_id,status,terms,agreed_amount,currency,funding_status,created_at')
            .eq('employer_id',employerId).order('created_at',{ascending:false}).limit(100),
        ])
        if(auth.error)throw auth.error
        if(!auth.data.user)throw new Error('Sign in again to manage work.')
        if(taskResult.error)throw taskResult.error
        if(contractResult.error)throw contractResult.error
        const taskRows=(taskResult.data??[]) as WorkTask[]
        const contractRows=(contractResult.data??[]) as Contract[]
        const [proposalResult,stepRows,reviewRows]=await Promise.all([
          taskRows.length ? supabase.from('marketplace_submissions')
            .select('id,task_id,user_id,status,proposal_text,proposed_amount,estimated_days')
            .in('task_id',taskRows.map(row=>row.id)).order('submitted_at',{ascending:false}).limit(200)
            : Promise.resolve({data:[] as WorkBid[],error:null}),
          fetchMyMilestones(contractRows.map(row=>row.id)),
          fetchMyReviews(contractRows.map(row=>row.id)),
        ])
        if(proposalResult.error)throw proposalResult.error
        if(!active)return
        setOwnId(auth.data.user.id)
        // A failed flag read is not permission to create contracts or move money.
        setEnabled(!readiness.error && readiness.data?.enabled===true)
        setPayoutsEnabled(!readiness.error && readiness.data?.payouts_enabled===true)
        setTasks(taskRows);setContracts(contractRows);setBids((proposalResult.data??[]) as WorkBid[])
        setMilestones(stepRows);setReviews(reviewRows)
      }catch(cause){if(active){setEnabled(false);setPayoutsEnabled(false);setError(cause instanceof Error?cause.message:'Could not load employer work.')}}
      finally{if(active)setLoading(false)}
    })()
    return()=>{active=false}
  },[employerId,revision])
  const reload=()=>setRevision(n=>n+1)
  const run=async(operation:()=>Promise<unknown>,message:string)=>{
    if(lock.current)return
    lock.current=true;setSaving(true);setError('');setNotice('')
    try{await operation();setNotice(message);setFocused(null);setCreateTask(false);reload()}
    catch(cause){setError(cause instanceof Error?cause.message:'MELA could not confirm the change.')}
    finally{lock.current=false;setSaving(false)}
  }
  const changePanel=(next:Panel)=>{setPanel(next);setFocused(null);setCreateTask(false);setError('');setNotice('')}
  const addTask=()=>void run(async()=>{
    if(!enabled||title.trim().length<8||description.trim().length<30||!amountIsValid(budget)||!deadline)throw new Error('Complete the title, description, valid ETB budget and deadline.')
    const cutoff=new Date(deadline+'T23:59:59')
    if(!Number.isFinite(cutoff.getTime())||cutoff.getTime()<=Date.now())throw new Error('Choose a future deadline.')
    const {error:saveError}=await supabase.from('marketplace_tasks').insert({
      employer_id:employerId,posted_by:ownId,status:'open',task_type:'freelance',currency:'ETB',
      title:title.trim(),description:description.trim(),budget_amount:Number(budget),
      deadline:cutoff.toISOString(),reward_coins:0,
    })
    if(saveError)throw saveError
    setTitle('');setDescription('');setBudget('');setDeadline('')
  },'Employer work task published. Applicants can view it while Earn & Work is enabled.')
  const shortlist=(bid:WorkBid)=>void run(async()=>{
    if(!enabled||bid.status!=='pending')throw new Error('This proposal cannot be shortlisted now.')
    const {data,error:saveError}=await supabase.rpc('shortlist_freelance_proposal',{p_submission_id:bid.id})
    if(saveError)throw saveError
    if(data?.status!=='shortlisted')throw new Error('Shortlist not confirmed.')
  },'Proposal shortlisted; no contract or payment was created.')
  const award=(bid:WorkBid,task:WorkTask)=>void run(async()=>{
    if(!enabled || !['pending','shortlisted'].includes(bid.status)||task.status!=='open')throw new Error('This proposal is no longer awardable.')
    const agreed=bid.proposed_amount??task.budget_amount
    if(!agreed || agreed<=0 || !Number.isFinite(agreed)|| (task.budget_amount!=null&&agreed>task.budget_amount))
      throw new Error('The agreed amount must be within the posted budget.')
    if(terms.trim().length<20||terms.trim().length>2000)throw new Error('Write 20–2000 characters of clear contract terms.')
    const {data,error:saveError}=await supabase.rpc('award_freelance_task',{
      p_submission_id:bid.id,p_agreed_amount:agreed,p_terms:terms.trim(),
    })
    if(saveError)throw saveError
    if(data?.status!=='proposed')throw new Error('Award not confirmed by the server.')
    setTerms('')
  },'Contract offer created. It must be accepted by the freelancer; funding is still unconfirmed.')
  const addMilestone=(contract:Contract)=>void run(async()=>{
    if(!enabled||!['proposed','active'].includes(contract.status)||milestoneTitle.trim().length<5||!amountIsValid(milestoneAmount))
      throw new Error('Choose a valid milestone title and amount.')
    const {data,error:saveError}=await supabase.rpc('create_task_milestone',{
      p_contract_id:contract.id,p_title:milestoneTitle.trim(),p_amount:Number(milestoneAmount),
      p_due_at:null,p_description:milestoneNote.trim()||null,
    })
    if(saveError)throw saveError
    if(!data?.id)throw new Error('Milestone not confirmed.')
    setMilestoneTitle('');setMilestoneAmount('');setMilestoneNote('')
  },'Milestone recorded. No escrow payment has been confirmed.')
  const reviewMilestone=(step:WorkMilestone,decision:'approved'|'rejected')=>void run(async()=>{
    if(!enabled||step.status!=='submitted')throw new Error('This milestone cannot be reviewed now.')
    if(decision==='approved'&&!payoutsEnabled)throw new Error('Financial release and payout review are paused.')
    const {data,error:saveError}=await supabase.rpc('review_task_milestone',{
      p_milestone_id:step.id,p_decision:decision,p_notes:milestoneNote.trim()||null,
    })
    if(saveError)throw saveError
    if(data?.status!==decision)throw new Error('Milestone decision not confirmed.')
    setMilestoneNote('')
  },'Employer milestone decision recorded. A reviewed milestone is not a confirmed outgoing payment.')
  const leaveReview=(contract:Contract)=>void run(()=>submitContractReview(contract.id,Number(rating),feedback),'Review saved for this completed contract.')
  const selectedTask=tasks.find(t=>t.id===focused)
  const selectedContract=contracts.find(c=>c.id===focused)
  const shownBids=bids.filter(bid=>!focused||bid.task_id===focused)
  return <div className="dash-main" aria-label="Employer Earn & Work">
    <div className="section-heading">
      <h1>Employer Earn & Work</h1>
      <button className="btn btn-secondary" type="button" onClick={onBack}>Back to employer dashboard</button>
    </div>
    <p>Manage verified freelance opportunities and existing contracts. MELA does not confirm payment until escrow is independently verified.</p>
    {loading&&<p role="status">Checking employer tasks and contracts…</p>}
    {!loading&&!enabled&&<div className="banner banner-info" role="status">New paid work and contract decisions are paused in production. Existing records remain visible; payouts and escrow transfers are not enabled here.</div>}
    {error&&<div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" type="button" onClick={reload} disabled={saving}>Retry</button></div>}
    {notice&&<p role="status">{notice}</p>}
    <div className="module-grid" role="group" aria-label="Employer work sections">
      <button type="button" className="btn btn-secondary" aria-pressed={panel==='tasks'} onClick={()=>changePanel('tasks')}>My work tasks ({tasks.length})</button>
      <button type="button" className="btn btn-secondary" aria-pressed={panel==='proposals'} onClick={()=>changePanel('proposals')}>Received proposals ({bids.length})</button>
      <button type="button" className="btn btn-secondary" aria-pressed={panel==='contracts'} onClick={()=>changePanel('contracts')}>Contracts ({contracts.length})</button>
    </div>
    {panel==='tasks'&&!loading&&(createTask ? <section className="list-panel">
      <button className="btn btn-secondary" onClick={()=>setCreateTask(false)}>Back to my tasks</button>
      <h2>Post freelance work</h2>
      <div className="field"><label htmlFor="employer-task-title">Task title</label><input id="employer-task-title" maxLength={160} value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div className="field"><label htmlFor="employer-task-description">What must be delivered?</label><textarea id="employer-task-description" maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)}/></div>
      <div className="field"><label htmlFor="employer-task-budget">Maximum agreed budget in ETB</label><input id="employer-task-budget" inputMode="decimal" value={budget} onChange={e=>setBudget(e.target.value)}/></div>
      <div className="field"><label htmlFor="employer-task-deadline">Application deadline</label><input id="employer-task-deadline" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div>
      <button className="btn btn-primary" type="button" disabled={saving||!enabled} onClick={addTask}>Publish verified employer task</button>
    </section> : <>
      <div className="section-heading"><h2>My freelance tasks</h2>{enabled&&<button className="btn btn-primary" type="button" onClick={()=>setCreateTask(true)}>Post paid task</button>}</div>
      {!tasks.length?<p className="empty-panel">No freelance work tasks posted yet.</p>:<div className="list-panel">{tasks.map(task=><div className="list-row" key={task.id}>
        <div><strong>{task.title}</strong><p>{task.status} · {task.budget_amount??'Unspecified'} {task.currency}</p></div>
        <button className="btn btn-secondary" type="button" onClick={()=>{setFocused(task.id);setPanel('proposals')}}>View proposals ({bids.filter(b=>b.task_id===task.id).length})</button>
      </div>)}</div>}
    </>)}
    {panel==='proposals'&&!loading&&(selectedTask ? <section className="list-panel">
      <button type="button" className="btn btn-secondary" onClick={()=>setFocused(null)}>Back to all proposals</button>
      <h2>{selectedTask.title}</h2><p>{selectedTask.description}</p><p>{selectedTask.status} · {selectedTask.budget_amount??'Unspecified'} {selectedTask.currency}</p>
      {!shownBids.length?<p>No proposals received for this task.</p>:shownBids.map(bid=><div className="list-panel" key={bid.id}>
        <strong>Proposal {bid.id.slice(0,8)}</strong><p>{bid.status} · proposed {bid.proposed_amount??'Unspecified'} {selectedTask.currency} · {bid.estimated_days??'Unspecified'} days</p><p>{bid.proposal_text}</p>
        {enabled&&selectedTask.status==='open'&&bid.status==='pending'&&<button type="button" className="btn btn-secondary" disabled={saving} onClick={()=>shortlist(bid)}>Shortlist</button>}
        {enabled&&selectedTask.status==='open'&&['pending','shortlisted'].includes(bid.status)&&<>
          <div className="field"><label htmlFor={`award-terms-${bid.id}`}>Contract terms (20–2000 characters)</label>
            <textarea id={`award-terms-${bid.id}`} value={terms} maxLength={2000} onChange={e=>setTerms(e.target.value)}/></div>
          <button type="button" className="btn btn-primary" disabled={saving||terms.trim().length<20} onClick={()=>award(bid,selectedTask)}>Offer contract</button>
        </>}
      </div>)}
    </section> : <>
      <h2>Received proposals</h2>
      {!bids.length?<p className="empty-panel">No freelance proposals received yet.</p>:<div className="list-panel">{tasks.filter(task=>bids.some(b=>b.task_id===task.id)).map(task=><div className="list-row" key={task.id}>
        <div><strong>{task.title}</strong><p>{bids.filter(b=>b.task_id===task.id).length} proposals · {task.status}</p></div>
        <button type="button" className="btn btn-secondary" onClick={()=>setFocused(task.id)}>Review proposals</button>
      </div>)}</div>}
    </>)}
    {panel==='contracts'&&!loading&&(selectedContract ? <section className="list-panel">
      <button type="button" className="btn btn-secondary" onClick={()=>setFocused(null)}>Back to contracts</button>
      <h2>Contract {selectedContract.id.slice(0,8)}</h2>
      <p>{selectedContract.status} · {selectedContract.agreed_amount} {selectedContract.currency} · funding {selectedContract.funding_status}</p>
      {selectedContract.terms&&<p><strong>Agreed terms:</strong> {selectedContract.terms}</p>}
      <h3>Milestones</h3>
      {!milestones.some(step=>step.contract_id===selectedContract.id)&&<p>No milestones recorded yet.</p>}
      {milestones.filter(step=>step.contract_id===selectedContract.id).map(step=><div className="list-panel" key={step.id}>
        <strong>{step.title}</strong><p>{step.amount} {selectedContract.currency} · {step.status}</p>
        {step.submission_note&&<p>{step.submission_note}</p>}
        {step.deliverable_url&&/^https:\/\//i.test(step.deliverable_url)&&<a href={step.deliverable_url} target="_blank" rel="noopener noreferrer">View deliverable</a>}
        {step.review_notes&&<p>Review notes: {step.review_notes}</p>}
        {enabled&&step.status==='submitted'&&<>
          <div className="field"><label htmlFor={`milestone-review-${step.id}`}>Review note</label>
            <textarea id={`milestone-review-${step.id}`} value={milestoneNote} maxLength={2000} onChange={e=>setMilestoneNote(e.target.value)}/></div>
          <button type="button" className="btn btn-secondary" disabled={saving||milestoneNote.trim().length<10} onClick={()=>reviewMilestone(step,'rejected')}>Request revision</button>
          {payoutsEnabled&&<button type="button" className="btn btn-primary" disabled={saving} onClick={()=>reviewMilestone(step,'approved')}>Approve funded milestone</button>}
          {!payoutsEnabled&&<p className="field-hint">Approval is paused until funded escrow and payout review are active.</p>}
        </>}
      </div>)}
      {enabled&&['proposed','active'].includes(selectedContract.status)&&<>
        <h3>Create contract milestone</h3>
        <div className="field"><label htmlFor="new-milestone-title">Milestone title</label><input id="new-milestone-title" value={milestoneTitle} maxLength={160} onChange={e=>setMilestoneTitle(e.target.value)}/></div>
        <div className="field"><label htmlFor="new-milestone-amount">Amount in {selectedContract.currency}</label><input id="new-milestone-amount" inputMode="decimal" value={milestoneAmount} onChange={e=>setMilestoneAmount(e.target.value)}/></div>
        <div className="field"><label htmlFor="new-milestone-description">Requirements (optional)</label><textarea id="new-milestone-description" value={milestoneNote} maxLength={2000} onChange={e=>setMilestoneNote(e.target.value)}/></div>
        <button type="button" className="btn btn-secondary" disabled={saving||!amountIsValid(milestoneAmount)} onClick={()=>addMilestone(selectedContract)}>Create milestone (not funded)</button>
      </>}
      {selectedContract.status==='completed'&&!reviews.some(review=>review.contract_id===selectedContract.id&&review.reviewer_user_id===ownId)&&<>
        <h3>Review the completed project</h3>
        <div className="field"><label htmlFor="employer-rating">Rating (1–5)</label><select id="employer-rating" value={rating} onChange={e=>setRating(e.target.value)}>
          {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} stars</option>)}</select></div>
        <div className="field"><label htmlFor="employer-feedback">Feedback</label><textarea id="employer-feedback" value={feedback} maxLength={2000} onChange={e=>setFeedback(e.target.value)}/></div>
        <button type="button" className="btn btn-secondary" disabled={saving} onClick={()=>leaveReview(selectedContract)}>Submit review</button>
      </>}
    </section> : <>
      <h2>My contracts</h2>
      {!contracts.length?<p className="empty-panel">No awarded freelance contracts yet.</p>:<div className="list-panel">{contracts.map(contract=><div className="list-row" key={contract.id}>
        <div><strong>Contract {contract.id.slice(0,8)}</strong><p>{contract.status} · {contract.agreed_amount} {contract.currency} · funding {contract.funding_status}</p></div>
        <button type="button" className="btn btn-secondary" onClick={()=>setFocused(contract.id)}>View milestones</button>
      </div>)}</div>}
    </>)}
    {!loading&&<button className="btn btn-secondary" type="button" disabled={saving} onClick={reload}>Refresh employer work</button>}
  </div>
}
