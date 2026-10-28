import { useEffect, useRef, useState } from 'react'
import {
  addMentorshipGoal, assignmentProgress, createMentorshipAssignment,
  deleteMentorshipGoal, loadMentorshipWorkspace, sendMentorshipFeedback,
  setMentorshipGoalStatus, submitMentorshipAssignment,
  type MentorshipWorkspace, type MentorshipGoal,
} from '../lib/mentorship-workspace'
import { supabase } from '../lib/supabase'
import MentorshipGroupInterest from './MentorshipGroupInterest'

type AcceptedRequest = { id: string; mentee_id: string; topic: string; status: string }

export default function MentorshipLearningWorkspace({ mode, stageKey, section = null }: { mode: 'learner' | 'mentor'; stageKey?: string | null; section?: number | null }) {
  const [workspace, setWorkspace] = useState<MentorshipWorkspace | null>(null)
  const [accepted, setAccepted] = useState<AcceptedRequest[]>([])
  const [error, setError] = useState('')
  const [acceptedError, setAcceptedError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const [goalTitle, setGoalTitle] = useState('')
  const [goalDetail, setGoalDetail] = useState('')
  const [goalDate, setGoalDate] = useState('')
  const [assignRequest, setAssignRequest] = useState('')
  const [assignTitle, setAssignTitle] = useState('')
  const [assignText, setAssignText] = useState('')
  const [assignDue, setAssignDue] = useState('')
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [reviews, setReviews] = useState<Record<string,string>>({})
  const [resourceQuery,setResourceQuery] = useState('')
  const [resourceCategory,setResourceCategory] = useState('all')
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    setWorkspace(null)
    setLoadFailed(false)
    setError('')
    setAcceptedError('')
    void (async () => {
      try {
        const workspaceData = await loadMentorshipWorkspace(mode, section)
        let acceptedData: AcceptedRequest[] = []
        if (mode === 'mentor') {
          const { data: auth, error: authError } = await supabase.auth.getUser()
          if (authError) throw authError
          if (!auth.user) throw new Error('Your session has expired.')
          const { data, error: requestError } = await supabase.from('mentorship_requests')
            .select('id,mentee_id,topic,status').eq('mentor_id',auth.user.id).eq('status','accepted')
            .order('created_at', { ascending: false }).limit(100)
          if (requestError) {
            if (active) setAcceptedError('Accepted learners could not load: ' + requestError.message + '. Existing assignments remain viewable; try Refresh.')
          } else {
            acceptedData = (data ?? []) as AcceptedRequest[]
          }
        }
        if (active) { setWorkspace(workspaceData); setAccepted(acceptedData) }
      } catch (cause) {
        if (active) { setLoadFailed(true); setError(cause instanceof Error ? cause.message : 'Could not load learning workspace.') }
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [mode, revision, section])

  const run = async (action: () => Promise<void>, onSuccess?: () => void) => {
    if (lock.current) return
    lock.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      await action()
      onSuccess?.()
      setNotice('Your mentorship update was saved.')
      setRevision((n) => n + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Please retry.')
    } finally { setBusy(false); lock.current = false }
  }
  const createGoal = (event: React.FormEvent) => {
    event.preventDefault()
    void run(() => addMentorshipGoal(goalTitle,goalDetail,goalDate), () => { setGoalTitle(''); setGoalDetail(''); setGoalDate('') })
  }
  const createAssignment = (event: React.FormEvent) => {
    event.preventDefault()
    const relation = accepted.find((request) => request.id === assignRequest)
    if (!relation) { setError('Choose an accepted mentor–learner relationship.'); return }
    void run(() => createMentorshipAssignment(relation.id,relation.mentee_id,assignTitle,assignText,assignDue), () => {
      setAssignTitle(''); setAssignText(''); setAssignDue('')
    })
  }

  const progress = workspace ? assignmentProgress(workspace) : { assigned: 0, submitted: 0, reviewed: 0 }
  const submissions = new Map((workspace?.submissions ?? []).map((item) => [item.assignment_id, item]))
  const feedback = new Map((workspace?.feedback ?? []).map((item) => [item.assignment_id, item]))
  const resourceCategories = Array.from(new Set(
    (workspace?.resources??[]).map(item=>item.category).filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b))
  const resourceSearch = resourceQuery.trim().toLocaleLowerCase()
  const resourceMatches = (workspace?.resources??[]).filter(item=>
    (resourceCategory==='all'||resourceCategory===item.category)
    && (!resourceSearch||[item.title,item.category,item.description,item.content]
      .join(' ').toLocaleLowerCase().includes(resourceSearch))
  )
  const reviewedFraction = progress.assigned>0 ? Math.round(100*progress.reviewed/progress.assigned) : 0

  return <section aria-label={mode === 'mentor' ? 'Mentor learning workspace' : 'Learner mentorship workspace'}>
    <div className="section-heading"><h2>{mode === 'mentor' ? 'Mentor learning workspace' : 'My mentorship learning journey'}</h2>
      <button className="btn btn-secondary" type="button" onClick={() => setRevision((n) => n + 1)} disabled={busy || loading}>Refresh</button></div>
    {notice && <p className="banner banner-info" role="status">{notice}</p>}
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" type="button" onClick={() => setRevision((n) => n + 1)} disabled={busy}>Retry</button></div>}
    {acceptedError && <p className="banner banner-error" role="alert">{acceptedError}</p>}
    {loading && <p role="status">Loading learning plans, resources and assignments…</p>}
    {!loading && !loadFailed && workspace && <>
      {mode === 'learner' && <section className="empty-panel" hidden={section !== null && section !== 9} id="mentorship-goals" style={{ textAlign:'left' }}>
        <h3>9. My learning goals and plans</h3>
        <p>Create goals that remain private to your account. A session or self-reported completion is not a verified achievement.</p>
        {workspace.goals.length === 0 ? <p className="muted">No personal mentorship goals yet.</p> : <div className="list-panel">{workspace.goals.map((goal) => <div className="list-row" key={goal.id}>
          <div style={{ flex:1 }}><strong>{goal.title}</strong>{goal.detail && <p>{goal.detail}</p>}{goal.target_date && <p className="muted">Target: {goal.target_date}</p>}</div>
          <div className="field"><label htmlFor={`goal-state-${goal.id}`}>Goal status</label>
            <select id={`goal-state-${goal.id}`} value={goal.status} disabled={busy} onChange={(event) => void run(() => setMentorshipGoalStatus(goal.id, event.target.value as MentorshipGoal['status']))}>
              <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed (self-reported)</option><option value="paused">Paused</option>
            </select>
          </div>
          <button className="btn btn-secondary" disabled={busy} onClick={() => void run(() => deleteMentorshipGoal(goal.id))}>Remove</button>
        </div>)}</div>}
        <form onSubmit={createGoal}>
          <div className="field"><label htmlFor="mentorship-goal-title">Goal title</label>
            <input id="mentorship-goal-title" value={goalTitle} minLength={3} maxLength={160} required disabled={busy} onChange={(event) => setGoalTitle(event.target.value)} placeholder="e.g. Build my first portfolio project" /></div>
          <div className="field"><label htmlFor="mentorship-goal-detail">My plan (optional)</label>
            <textarea id="mentorship-goal-detail" value={goalDetail} maxLength={2000} rows={3} disabled={busy} onChange={(event) => setGoalDetail(event.target.value)} /></div>
          <div className="field"><label htmlFor="mentorship-goal-date">Target date (optional)</label>
            <input id="mentorship-goal-date" type="date" value={goalDate} disabled={busy} onChange={(event) => setGoalDate(event.target.value)} /></div>
          <button className="btn btn-primary" disabled={busy || goalTitle.trim().length < 3}>{busy ? 'Saving…' : 'Add personal goal'}</button>
        </form>
      </section>}

      <section hidden={section !== null && section !== 11} id="mentorship-assignments" className="empty-panel" style={{ textAlign:'left' }}>
        <h3>11. Challenges, assignments and feedback</h3>
        <p>{mode === 'mentor' ? 'Only assign work to learners with an accepted mentorship request.' : 'Assignments from your approved mentor appear here. Responses are visible only to you and your mentor.'}</p>
        {mode === 'mentor' && <form onSubmit={createAssignment}>
          <div className="field"><label htmlFor="assign-relation">Accepted mentorship request</label>
            <select id="assign-relation" value={assignRequest} disabled={busy} onChange={(event) => setAssignRequest(event.target.value)} required>
              <option value="">Choose request</option>{accepted.map((request) => <option key={request.id} value={request.id}>{request.topic || 'Mentorship'} · {request.id.slice(0,8)}</option>)}
            </select></div>
          <div className="field"><label htmlFor="assignment-title">Assignment title</label>
            <input id="assignment-title" value={assignTitle} disabled={busy} minLength={3} maxLength={160} required onChange={(event) => setAssignTitle(event.target.value)} /></div>
          <div className="field"><label htmlFor="assignment-instructions">Instructions</label>
            <textarea id="assignment-instructions" value={assignText} disabled={busy} minLength={10} maxLength={4000} rows={4} required onChange={(event) => setAssignText(event.target.value)} /></div>
          <div className="field"><label htmlFor="assignment-due">Due date (optional)</label>
            <input id="assignment-due" type="datetime-local" disabled={busy} value={assignDue} onChange={(event) => setAssignDue(event.target.value)} /></div>
          <button className="btn btn-primary" disabled={busy || !assignRequest || assignTitle.trim().length < 3 || assignText.trim().length < 10}>Assign to learner</button>
        </form>}
        {workspace.assignments.length === 0 ? <p className="muted">No assignments have been issued.</p> : <div className="list-panel">{workspace.assignments.map((task) => {
          const answer = submissions.get(task.id)
          const review = feedback.get(task.id)
          return <article className="list-row" key={task.id} style={{ display: 'block' }}>
            <strong>{task.title}</strong>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{task.instructions}</p>
            {task.due_at && <p className="muted">Target: {new Date(task.due_at).toLocaleString()}</p>}
            {answer ? <div><p><strong>Learner response:</strong> {answer.response}</p></div> : mode === 'learner'
              ? <div className="field"><label htmlFor={`answer-${task.id}`}>My response</label>
                  <textarea id={`answer-${task.id}`} rows={3} maxLength={4000} disabled={busy} value={answers[task.id] ?? ''} onChange={(e) => setAnswers((v) => ({ ...v, [task.id]:e.target.value }))} />
                  <button className="btn btn-primary" disabled={busy || (answers[task.id] ?? '').trim().length < 2}
                    onClick={() => void run(() => submitMentorshipAssignment(task.id,answers[task.id] ?? ''), () => setAnswers((v) => { const out = { ...v }; delete out[task.id]; return out }))}>Submit response</button>
                </div> : <p className="muted">Awaiting learner submission.</p>}
            {review ? <p><strong>Mentor feedback:</strong> {review.feedback}</p> : answer && mode === 'mentor' && <div className="field">
              <label htmlFor={`feedback-${task.id}`}>Give constructive feedback</label>
              <textarea id={`feedback-${task.id}`} maxLength={4000} rows={3} disabled={busy} value={reviews[task.id] ?? ''} onChange={(e) => setReviews((v) => ({ ...v, [task.id]:e.target.value }))} />
              <button className="btn btn-primary" disabled={busy || (reviews[task.id] ?? '').trim().length < 2}
                onClick={() => void run(() => sendMentorshipFeedback(task.id,reviews[task.id] ?? ''))}>Send feedback</button>
            </div>}
          </article>
        })}</div>}
      </section>

      <section hidden={section !== null && section !== 12} id="mentorship-progress" className="empty-panel" style={{ textAlign:'left' }}>
        <h3>12. Progress and outcomes</h3>
        <div className="module-grid">
          <div><strong>{progress.assigned}</strong><p className="muted">Assigned tasks</p></div>
          <div><strong>{progress.submitted}</strong><p className="muted">Submitted tasks</p></div>
          <div><strong>{progress.reviewed}</strong><p className="muted">Mentor reviews</p></div>
          {mode === 'learner' && <div><strong>{workspace.goals.filter((goal) => goal.status === 'completed').length}</strong><p className="muted">Self-reported goals</p></div>}
        </div>
        <label htmlFor="mentorship-reviewed-progress">Share of assigned tasks with feedback: {reviewedFraction}%</label>
        <progress id="mentorship-reviewed-progress" max={100} value={reviewedFraction} style={{width:'100%',maxWidth:'28rem'}}/>
        <p className="muted">{progress.assigned===0 ?
          'No assignments have been issued, so this indicator starts at 0%.'
          : progress.reviewed+' of '+progress.assigned+' assigned tasks have documented mentor feedback.'}
          {' '}This measures recorded activity, not mastery or a verified certificate. No Career Passport credential is automatically awarded.</p>
      </section>
      <section hidden={mode === 'mentor' || (section !== null && section !== 10)} id="mentorship-library" className="empty-panel" style={{ textAlign:'left' }}>
        <h3>10. Mentorship resources library</h3>
        {workspace.resources.length===0?<p className="muted">No published mentorship guides are available yet.</p>:<>
          <div className="field"><label htmlFor="mentorship-resource-search">Find guidance by topic or keyword</label>
            <input type="search" id="mentorship-resource-search" value={resourceQuery}
              onChange={event=>setResourceQuery(event.target.value)}
              placeholder="e.g. scholarship, resume, safety, study plan"/>
          </div>
          <div className="field"><label htmlFor="mentorship-resource-category">Guide category</label>
            <select id="mentorship-resource-category" value={resourceCategory}
              onChange={event=>setResourceCategory(event.target.value)}>
              <option value="all">All published guidance categories</option>
              {resourceCategories.map(category=><option value={category} key={category}>{category}</option>)}
            </select>
          </div>
          <p role="status">{resourceMatches.length} of {workspace.resources.length} published guides match.</p>
          {(resourceQuery||resourceCategory!=='all')&&<button type="button" className="btn btn-secondary"
            onClick={()=>{setResourceQuery('');setResourceCategory('all')}}>Clear resource search</button>}
          {resourceMatches.length===0?<p>No published guide matches your selected topic.</p>:
            resourceMatches.map((guide)=><details key={guide.id} className="list-row" style={{display:'block',marginBottom:'.5rem'}}>
              <summary><strong>{guide.title}</strong> · {guide.category}</summary>
              <p>{guide.description}</p><p style={{whiteSpace:'pre-wrap'}}>{guide.content}</p>
            </details>)}
        </>}
      </section>
      <section hidden={mode === 'mentor' || (section !== null && section !== 13)} id="mentorship-groups" className="empty-panel" style={{ textAlign:'left' }}>
        <h3>13. Group mentorship</h3>
        {mode === 'mentor' ? <p className="muted">Verified facilitators can propose supervised groups through the Central Admin review workflow.</p>
          : !['university','college_tvet'].includes(stageKey ?? '') ?
            <p className="muted">Group applications currently require adult university or TVET eligibility. You may use the approved individual mentorship resources instead.</p>
            : <MentorshipGroupInterest groups={workspace.groups} />}
      </section>
    </>}
  </section>
}
