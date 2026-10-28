import { useEffect, useRef, useState } from 'react'
import {
  addMentorshipGoal, assignmentProgress, mentorshipActionSummary, createMentorshipAssignment,
  deleteMentorshipGoal, loadMentorshipWorkspace, sendMentorshipFeedback, updateMentorshipGoal,
  setMentorshipGoalStatus, submitMentorshipAssignment,
  type MentorshipWorkspace, type MentorshipGoal,
} from '../lib/mentorship-workspace'
import { supabase } from '../lib/supabase'
import MentorshipGroupInterest from './MentorshipGroupInterest'

type AcceptedRequest = { id: string; mentee_id: string; topic: string; status: string }

const ASSIGNMENT_STARTERS = [
  {
    name: 'Weekly study',
    title: 'One-week study reflection',
    instructions: 'Choose one relevant subject topic. Complete two practice activities, describe what you learned, and explain one question to discuss with your mentor.',
  },
  {
    name: 'Career research',
    title: 'Compare two career paths',
    instructions: 'Research two careers using reliable sources. Compare entry requirements, everyday tasks and skills to practise. Explain which path interests you and why.',
  },
  {
    name: 'Scholarship readiness',
    title: 'Check scholarship eligibility safely',
    instructions: 'Use an official scholarship or university page to note eligibility, documents and deadlines. Do not share identity numbers, passwords or private documents in the assignment.',
  },
  {
    name: 'Practical project',
    title: 'Prepare a small portfolio project',
    instructions: 'Define a manageable project, create a first draft, describe your own contribution and testing steps, then ask for one specific improvement.',
  },
] as const

export default function MentorshipLearningWorkspace({ mode, stageKey, section = null, onNavigate }: {
  mode: 'learner' | 'mentor'; stageKey?: string | null; section?: number | null
  onNavigate?: (section: number) => void
}) {
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
  const [confirmRemoveGoal, setConfirmRemoveGoal] = useState<string | null>(null)
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null)
  const [editingGoalTitle, setEditingGoalTitle] = useState('')
  const [editingGoalDetail, setEditingGoalDetail] = useState('')
  const [editingGoalDate, setEditingGoalDate] = useState('')
  const [assignRequest, setAssignRequest] = useState('')
  const [assignTitle, setAssignTitle] = useState('')
  const [assignText, setAssignText] = useState('')
  const [assignDue, setAssignDue] = useState('')
  const [assignmentView,setAssignmentView] = useState<'newest'|'due_soon'|'needs_action'>('newest')
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [reviews, setReviews] = useState<Record<string,string>>({})
  const [assignmentFilter,setAssignmentFilter] = useState<'all'|'pending'|'waiting'|'reviewed'>('all')
  const [resourceQuery,setResourceQuery] = useState('')
  const [resourceCategory,setResourceCategory] = useState('all')
  const [plannedGuideId,setPlannedGuideId] = useState<string | null>(null)
  const [guidePlanTitle,setGuidePlanTitle] = useState('')
  const [guidePlanDetails,setGuidePlanDetails] = useState('')
  const [guidePlanDate,setGuidePlanDate] = useState('')
  const lock = useRef(false)

  // A role switch is a privacy boundary on shared devices.
  useEffect(() => {
    setGoalTitle('');setGoalDetail('');setGoalDate('')
    setEditingGoalId(null);setEditingGoalTitle('');setEditingGoalDetail('');setEditingGoalDate('')
    setConfirmRemoveGoal(null)
    setAssignRequest('');setAssignTitle('');setAssignText('');setAssignDue('')
    setAnswers({});setReviews({})
    setPlannedGuideId(null);setGuidePlanTitle('');setGuidePlanDetails('');setGuidePlanDate('')
  },[mode])

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

  const run = async (action: () => Promise<void>, onSuccess?: () => void,
    successMessage = 'Your mentorship update was saved.') => {
    if (lock.current) return
    lock.current = true
    setBusy(true); setError(''); setNotice('')
    try {
      await action()
      onSuccess?.()
      setNotice(successMessage)
      setRevision((n) => n + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Please retry.')
    } finally { setBusy(false); lock.current = false }
  }
  const createGoal = (event: React.FormEvent) => {
    event.preventDefault()
    void run(() => addMentorshipGoal(goalTitle,goalDetail,goalDate), () => { setGoalTitle(''); setGoalDetail(''); setGoalDate('') })
  }
  const editGoal = (goal: MentorshipGoal) => {
    setEditingGoalId(goal.id)
    setEditingGoalTitle(goal.title)
    setEditingGoalDetail(goal.detail ?? '')
    setEditingGoalDate(goal.target_date ?? '')
    setConfirmRemoveGoal(null)
  }
  const saveGoalEdit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!editingGoalId) return
    const id = editingGoalId
    void run(() => updateMentorshipGoal(id,editingGoalTitle,editingGoalDetail,editingGoalDate), () => {
      setEditingGoalId(null)
      setEditingGoalTitle('')
      setEditingGoalDetail('')
      setEditingGoalDate('')
    })
  }
  const startGuidePlan = (guide: MentorshipWorkspace['resources'][number]) => {
    setPlannedGuideId(guide.id)
    setGuidePlanTitle(('Study: '+guide.title).slice(0,160))
    setGuidePlanDetails('Read the published guide, write three questions, and choose one practical step to try.')
    setGuidePlanDate('')
  }
  const saveGuidePlan = (event: React.FormEvent) => {
    event.preventDefault()
    if (!plannedGuideId || !workspace?.resources.some(guide=>guide.id===plannedGuideId)) return
    void run(()=>addMentorshipGoal(guidePlanTitle,guidePlanDetails,guidePlanDate),
      ()=>{setPlannedGuideId(null);setGuidePlanTitle('');setGuidePlanDetails('');setGuidePlanDate('')},
      'Your guide study goal was saved to My Mentorship (section 9). This is a personal plan, not a verified achievement.')
  }
  const createAssignment = (event: React.FormEvent) => {
    event.preventDefault()
    const relation = accepted.find((request) => request.id === assignRequest)
    if (!relation) { setError('Choose an accepted mentor–learner relationship.'); return }
    void run(() => createMentorshipAssignment(relation.id,relation.mentee_id,assignTitle,assignText,assignDue), () => {
      setAssignTitle(''); setAssignText(''); setAssignDue('')
    })
  }

  const assignmentDueInvalid = Boolean(assignDue) &&
    (!Number.isFinite(Date.parse(assignDue)) || Date.parse(assignDue) <= Date.now())
  const progress = workspace ? assignmentProgress(workspace) : { assigned: 0, submitted: 0, reviewed: 0 }
  const nextActions = workspace ? mentorshipActionSummary(workspace) :
    { activeGoals: 0, overdueGoals: 0, assignmentsToSubmit: 0, overdueAssignments: 0, awaitingFeedback: 0 }
  const goalTemplates = ['school_1_6','school_7_8','school_9_10','school_11_12'].includes(stageKey ?? '')
    ? [
        { title: 'Build a weekly study routine', detail: 'Choose a subject, practise several times this week, and record one thing I understand better.' },
        { title: 'Prepare three career questions', detail: 'Discuss education and job paths with my approved teacher or guardian before seeking professional mentoring.' },
      ]
    : [
        { title: 'Build a portfolio project', detail: 'Choose a small project, define a milestone, save evidence, and request constructive feedback.' },
        { title: 'Prepare for a career conversation', detail: 'Research two careers, draft three questions, and identify a skill I can practise.' },
      ]
  const submissions = new Map((workspace?.submissions ?? []).map((item) => [item.assignment_id, item]))
  const feedback = new Map((workspace?.feedback ?? []).map((item) => [item.assignment_id, item]))
  const filteredAssignments = (workspace?.assignments??[]).filter(task => {
    const hasResponse = submissions.has(task.id)
    const hasReview = hasResponse && feedback.has(task.id)
    if (assignmentFilter === 'pending') return !hasResponse
    if (assignmentFilter === 'waiting') return hasResponse && !hasReview
    if (assignmentFilter === 'reviewed') return hasReview
    return true
  }).sort((a,b)=>{
    if (assignmentView === 'due_soon') {
      const time = (item:typeof a) => item.due_at && Number.isFinite(Date.parse(item.due_at))
        ? Date.parse(item.due_at) : Number.POSITIVE_INFINITY
      return time(a)-time(b) || a.id.localeCompare(b.id)
    }
    if (assignmentView === 'needs_action') {
      const rank = (item:typeof a) => submissions.has(item.id)
        ? feedback.has(item.id) ? 2 : mode === 'mentor' ? 0 : 1
        : mode === 'mentor' ? 1 : 0
      return rank(a)-rank(b) || a.id.localeCompare(b.id)
    }
    return Date.parse(b.created_at)-Date.parse(a.created_at) || a.id.localeCompare(b.id)
  })
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
    {notice && <p className="banner banner-info" role="status">{notice}
      {notice.includes('guide study goal was saved') && onNavigate && <button type="button" className="btn btn-secondary"
        onClick={() => onNavigate(9)}>View saved learning goal</button>}
    </p>}
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" type="button" onClick={() => setRevision((n) => n + 1)} disabled={busy}>Retry</button></div>}
    {acceptedError && <p className="banner banner-error" role="alert">{acceptedError}</p>}
    {loading && <p role="status">Loading learning plans, resources and assignments…</p>}
    {!loading && !loadFailed && workspace && <>
      {mode === 'learner' && <section className="empty-panel" hidden={section !== null && section !== 9} id="mentorship-goals" style={{ textAlign:'left' }}>
        <h3>9. My learning goals and plans</h3>
        <p>Create goals that remain private to your account. A session or self-reported completion is not a verified achievement.</p>
        {workspace.goals.length === 0 ? <p className="muted">No personal mentorship goals yet.</p> : <div className="list-panel">{workspace.goals.map((goal) => <div className="list-row" key={goal.id}>
          <div style={{ flex:1 }}>
            {editingGoalId === goal.id ? <form aria-label={'Edit goal ' + goal.title} onSubmit={saveGoalEdit}>
              <div className="field"><label htmlFor={'edit-goal-title-' + goal.id}>Edit goal title</label>
                <input id={'edit-goal-title-' + goal.id} required minLength={3} maxLength={160}
                  disabled={busy} value={editingGoalTitle} onChange={event => setEditingGoalTitle(event.target.value)}/></div>
              <div className="field"><label htmlFor={'edit-goal-plan-' + goal.id}>Edit learning plan</label>
                <textarea id={'edit-goal-plan-' + goal.id} rows={3} maxLength={2000}
                  disabled={busy} value={editingGoalDetail} onChange={event => setEditingGoalDetail(event.target.value)}/></div>
              <div className="field"><label htmlFor={'edit-goal-target-' + goal.id}>Edit target date</label>
                <input id={'edit-goal-target-' + goal.id} type="date" disabled={busy}
                  value={editingGoalDate} onChange={event => setEditingGoalDate(event.target.value)}/></div>
              <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
                <button type="submit" className="btn btn-primary"
                  disabled={busy || editingGoalTitle.trim().length < 3}>Save goal changes</button>
                <button type="button" className="btn btn-secondary" disabled={busy}
                  onClick={() => setEditingGoalId(null)}>Discard edits</button>
              </div>
            </form> : <>
              <strong>{goal.title}</strong>{goal.detail && <p>{goal.detail}</p>}
              {goal.target_date && <p className="muted">Target: {goal.target_date}</p>}
              <button type="button" className="btn btn-secondary" disabled={busy}
                onClick={() => editGoal(goal)}>Edit goal</button>
            </>}
          </div>
          <div className="field"><label htmlFor={`goal-state-${goal.id}`}>Goal status</label>
            <select id={`goal-state-${goal.id}`} value={goal.status} disabled={busy} onChange={(event) => void run(() => setMentorshipGoalStatus(goal.id, event.target.value as MentorshipGoal['status']))}>
              <option value="planned">Planned</option><option value="in_progress">In progress</option><option value="completed">Completed (self-reported)</option><option value="paused">Paused</option>
            </select>
          </div>
          {confirmRemoveGoal === goal.id ? <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void run(
              () => deleteMentorshipGoal(goal.id), () => setConfirmRemoveGoal(null)
            )}>Confirm removal</button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirmRemoveGoal(null)}>Keep goal</button>
          </div> : <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirmRemoveGoal(goal.id)}>Remove</button>}
        </div>)}</div>}
        <p className="muted">Need ideas? Choose a starter plan to fill the form below. Nothing is saved until you select Add personal goal.</p>
        <div style={{display:'flex',flexWrap:'wrap',gap:'.5rem',marginBottom:'.75rem'}}>
          {goalTemplates.map(item => <button type="button" className="btn btn-secondary" key={item.title}
            disabled={busy} onClick={() => {setGoalTitle(item.title);setGoalDetail(item.detail);setGoalDate('')}}>
              Use: {item.title}
          </button>)}
        </div>
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
          <p className="muted">Choose a task starter to fill editable instructions; nothing is assigned or sent until you choose an accepted learner and submit.</p>
          <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap',marginBottom:'.75rem'}}>
            {ASSIGNMENT_STARTERS.map(starter=><button type="button" key={starter.name}
              className="btn btn-secondary" disabled={busy}
              onClick={()=>{setAssignTitle(starter.title);setAssignText(starter.instructions)}}>
              Use: {starter.name} task
            </button>)}
          </div>
          <div className="field"><label htmlFor="assign-relation">Accepted mentorship request</label>
            <select id="assign-relation" value={assignRequest} disabled={busy} onChange={(event) => setAssignRequest(event.target.value)} required>
              <option value="">Choose request</option>{accepted.map((request) => <option key={request.id} value={request.id}>{request.topic || 'Mentorship'} · {request.id.slice(0,8)}</option>)}
            </select></div>
          <div className="field"><label htmlFor="assignment-title">Assignment title</label>
            <input id="assignment-title" value={assignTitle} disabled={busy} minLength={3} maxLength={160} required onChange={(event) => setAssignTitle(event.target.value)} /></div>
          <div className="field"><label htmlFor="assignment-instructions">Instructions</label>
            <textarea id="assignment-instructions" value={assignText} disabled={busy} minLength={10} maxLength={4000} rows={4} required onChange={(event) => setAssignText(event.target.value)} /></div>
          <div className="field"><label htmlFor="assignment-due">Due date (optional)</label>
            <input id="assignment-due" type="datetime-local" disabled={busy} value={assignDue} onChange={(event) => setAssignDue(event.target.value)} />
            {assignmentDueInvalid && <p role="status" className="muted">Choose a future due date and time, or leave this blank.</p>}</div>
          <button className="btn btn-primary" disabled={busy || !assignRequest || assignmentDueInvalid || assignTitle.trim().length < 3 || assignText.trim().length < 10}>Assign to learner</button>
        </form>}
        {workspace.assignments.length > 0 && <div className="field">
          <label htmlFor="mentorship-assignment-filter">Show assignments</label>
          <select id="mentorship-assignment-filter" value={assignmentFilter} onChange={event=>setAssignmentFilter(event.target.value as typeof assignmentFilter)}>
            <option value="all">All assigned tasks</option>
            <option value="pending">{mode === 'mentor' ? 'Awaiting learner response' : 'Needs my response'}</option>
            <option value="waiting">{mode === 'mentor' ? 'Needs my feedback' : 'Awaiting mentor feedback'}</option>
            <option value="reviewed">Feedback recorded</option>
          </select>
          <p className="muted">{filteredAssignments.length} of {workspace.assignments.length} assigned tasks shown</p>
          <label htmlFor="mentorship-assignment-sort">Order assignments</label>
          <select id="mentorship-assignment-sort" value={assignmentView} onChange={event=>setAssignmentView(event.target.value as typeof assignmentView)}>
            <option value="newest">Newest assigned first</option>
            <option value="due_soon">Soonest deadline first</option>
            <option value="needs_action">Needs attention first</option>
          </select>
        </div>}
        {workspace.assignments.length === 0 ? <p className="muted">No assignments have been issued.</p> : filteredAssignments.length === 0
          ? <p className="muted">No assigned tasks match this status filter. Choose All assigned tasks to see everything.</p>
          : <div className="list-panel">{filteredAssignments.map((task) => {
          const answer = submissions.get(task.id)
          const review = feedback.get(task.id)
          return <article className="list-row" key={task.id} style={{ display: 'block' }}>
            <strong>{task.title}</strong>
            <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{task.instructions}</p>
            {task.due_at && <p className="muted">Target: {new Date(task.due_at).toLocaleString()}
              {!answer && Number.isFinite(Date.parse(task.due_at)) && Date.parse(task.due_at) < Date.now()
                ? ' · Past due: response not recorded' : ''}
            </p>}
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
                onClick={() => void run(() => sendMentorshipFeedback(task.id,reviews[task.id] ?? ''),
                  () => setReviews(current=>{const copy={...current};delete copy[task.id];return copy}))}>Send feedback</button>
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
        <h4>What needs attention</h4>
        {onNavigate && <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap',marginBottom:'.75rem'}}>
          {mode === 'learner' && <button type="button" className="btn btn-secondary"
            onClick={()=>onNavigate(9)}>Open my learning goals</button>}
          <button type="button" className="btn btn-secondary"
            onClick={()=>onNavigate(11)}>{mode === 'mentor' ? 'Review learner assignments' : 'Open my assignments'}</button>
        </div>}
        <div className="module-grid" aria-label="My mentorship action summary">
          {mode === 'learner' && <>
            <div><strong>{nextActions.activeGoals}</strong><p className="muted">Goals in progress or planned</p></div>
            <div><strong>{nextActions.overdueGoals}</strong><p className="muted">Goals past target date</p></div>
          </>}
          <div><strong>{nextActions.assignmentsToSubmit}</strong><p className="muted">{mode === 'mentor' ? 'Assigned tasks awaiting learner response' : 'Assignments awaiting my response'}</p></div>
          <div><strong>{nextActions.overdueAssignments}</strong><p className="muted">Assigned tasks past due</p></div>
          <div><strong>{nextActions.awaitingFeedback}</strong><p className="muted">{mode === 'mentor' ? 'Submitted tasks needing my feedback' : 'Submitted tasks awaiting mentor feedback'}</p></div>
        </div>
        <p className="muted">These are saved activity indicators, not a skill score. Overdue means the target date has passed without a recorded response or goal completion.</p>
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
              <p className="muted">Turn this published reading into an editable private study goal. No progress is recorded automatically.</p>
              {plannedGuideId === guide.id ? <form onSubmit={saveGuidePlan} aria-label={'Study plan for '+guide.title}>
                <div className="field"><label htmlFor={'guide-plan-title-'+guide.id}>Study goal title</label>
                  <input id={'guide-plan-title-'+guide.id} value={guidePlanTitle} minLength={3} maxLength={160}
                    required disabled={busy} onChange={event=>setGuidePlanTitle(event.target.value)}/></div>
                <div className="field"><label htmlFor={'guide-plan-notes-'+guide.id}>My next steps</label>
                  <textarea id={'guide-plan-notes-'+guide.id} value={guidePlanDetails} maxLength={2000}
                    rows={3} disabled={busy} onChange={event=>setGuidePlanDetails(event.target.value)}/></div>
                <div className="field"><label htmlFor={'guide-plan-date-'+guide.id}>Target date (optional)</label>
                  <input id={'guide-plan-date-'+guide.id} type="date" value={guidePlanDate}
                    disabled={busy} onChange={event=>setGuidePlanDate(event.target.value)}/></div>
                <button className="btn btn-primary" type="submit"
                  disabled={busy || guidePlanTitle.trim().length<3}>Save as my learning goal</button>{' '}
                <button className="btn btn-secondary" type="button" disabled={busy}
                  onClick={()=>setPlannedGuideId(null)}>Cancel study plan</button>
              </form> : <button type="button" className="btn btn-secondary"
                disabled={busy} onClick={()=>startGuidePlan(guide)}>Plan to study this guide</button>}
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
