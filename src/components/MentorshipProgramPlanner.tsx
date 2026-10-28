import { useEffect, useRef, useState } from 'react'
import {
  addMentorshipGoal, loadMentorshipWorkspace, setMentorshipGoalStatus,
  type MentorshipGoal,
} from '../lib/mentorship-workspace'

type TrackId = 'starter' | 'standard' | 'intensive'
type AreaId = 'study' | 'career' | 'scholarship' | 'project'
type Track = { id: TrackId; name: string; weeks: number }
type Area = { id: AreaId; name: string; milestones: readonly string[] }

const TRACKS: readonly Track[] = [
  { id: 'starter', name: 'Starter', weeks: 2 },
  { id: 'standard', name: 'Standard', weeks: 4 },
  { id: 'intensive', name: 'Intensive', weeks: 8 },
]

const AREAS: readonly Area[] = [
  { id: 'study', name: 'Academic learning', milestones: [
    'Choose one curriculum topic and record what I already know.',
    'Practise the topic and write three questions for a teacher or approved guide.',
    'Complete a new worked example and explain my steps.',
    'Review mistakes and compare my new answer with my starting work.',
    'Explore a connected topic using a published learning resource.',
    'Create a short study worksheet or project independently.',
    'Ask a qualified educator to review my evidence when available.',
    'Summarize my learning and choose the next curriculum goal.',
  ] },
  { id: 'career', name: 'Career exploration', milestones: [
    'Choose two careers and investigate their day-to-day tasks.',
    'List the skills and education pathways each career requires.',
    'Compare careers against my interests without making promises of employment.',
    'Create an achievable skills practice plan for the next month.',
    'Complete a free introductory learning exercise in one chosen field.',
    'Draft a simple portfolio example using only my own work.',
    'Discuss career questions with a verified mentor or trusted educator when eligible.',
    'Review my evidence and identify one realistic next step.',
  ] },
  { id: 'scholarship', name: 'Scholarship preparation', milestones: [
    'Identify the official eligibility rules for one genuine scholarship.',
    'List required documents without uploading sensitive identification here.',
    'Check official application deadlines and study requirements.',
    'Draft a personal statement outline for review.',
    'Find reliable free preparation resources.',
    'Practise describing my academic interests and achievements accurately.',
    'Request safe feedback from an approved educator when eligible.',
    'Review my checklist against the official scholarship website.',
  ] },
  { id: 'project', name: 'Practical project', milestones: [
    'Choose one manageable learning project and define the result.',
    'Break the project into clear tasks and gather safe learning resources.',
    'Create a first working draft or demonstration.',
    'Test the work and record what needs improvement.',
    'Revise based on evidence, not self-reported skill scores.',
    'Document my own contribution and the obstacles I resolved.',
    'Ask a verified mentor for constructive feedback when eligible.',
    'Present what I learned and plan the next iteration.',
  ] },
]

const planTitle = (area: Area, track: Track) =>
  'Mentorship plan: ' + area.name + ' · ' + track.name + ' (' + track.weeks + ' weeks)'

export default function MentorshipProgramPlanner({
  stageKey, onNavigate,
}: {
  stageKey?: string | null
  onNavigate?: (section: number) => void
}) {
  const [trackId, setTrackId] = useState<TrackId>('starter')
  const [areaId, setAreaId] = useState<AreaId>('study')
  const [myNextStep, setMyNextStep] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [goals, setGoals] = useState<MentorshipGoal[]>([])
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const lock = useRef(false)

  const adult = stageKey === 'university' || stageKey === 'college_tvet'
  const advanced = adult || stageKey === 'school_11_12'
  const allowedAreas = advanced ? AREAS : AREAS.filter(item => item.id === 'study')
  const area = allowedAreas.find(item => item.id === areaId) ?? allowedAreas[0]
  const track = TRACKS.find(item => item.id === trackId) ?? TRACKS[0]
  const title = planTitle(area, track)
  const existing = goals.find(goal => goal.title === title) ?? null
  const milestones = area.milestones.slice(0, track.weeks)

  // Do not retain a private learner's draft when the educational stage changes
  // on a shared phone. This is additional UX protection, not an RLS boundary.
  useEffect(() => {
    setTrackId('starter');setAreaId('study');setMyNextStep('');setTargetDate('')
  }, [stageKey])

  useEffect(() => {
    let active = true
    setLoading(true);setAvailable(false);setError('');setGoals([])
    void loadMentorshipWorkspace('learner', 9)
      .then(data => {
        if(active){setGoals(data.goals);setAvailable(true)}
      })
      .catch(cause => {
        if(active)setError(cause instanceof Error ? cause.message : 'Could not verify your private learning plans.')
      })
      .finally(() => {if(active)setLoading(false)})
    return () => {active=false}
  }, [revision, stageKey])

  useEffect(() => {
    const clear = () => {
      setGoals([]);setAvailable(false);setMyNextStep('');setTargetDate('')
      setRevision(n => n + 1)
    }
    window.addEventListener('mela:session-boundary', clear)
    return () => window.removeEventListener('mela:session-boundary', clear)
  }, [])

  const savePlan = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if(lock.current || loading || !available || existing || myNextStep.trim().length > 350)return
    const detail = [
      'Self-guided MELA learning plan; this is not mentor assignment or formal program enrollment.',
      ...milestones.map((step,index) => 'Week ' + (index + 1) + ': ' + step),
      myNextStep.trim() ? 'My personal next step: ' + myNextStep.trim() : '',
    ].filter(Boolean).join('\n')
    lock.current = true;setBusy(true);setNotice('');setError('')
    void addMentorshipGoal(title, detail, targetDate)
      .then(() => {
        setNotice('Your personal plan was saved. Review or update its status in My Mentorship; no verified credential was issued.')
        setMyNextStep('');setTargetDate('')
        setRevision(n => n + 1)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not save your plan. Your draft is still here.'))
      .finally(() => {lock.current=false;setBusy(false)})
  }

  const updateStatus = (goal: MentorshipGoal, status: MentorshipGoal['status']) => {
    if(lock.current || loading || !available)return
    lock.current=true;setBusy(true);setNotice('');setError('')
    void setMentorshipGoalStatus(goal.id,status)
      .then(() => {
        setNotice('Your personal plan status was saved. Completion is self-reported, not certified.')
        setRevision(n=>n+1)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not update your plan.'))
      .finally(() => {lock.current=false;setBusy(false)})
  }

  const savedPlans = goals.filter(goal => goal.title.startsWith('Mentorship plan: '))

  return <section className="empty-panel" id="mentorship-program-planner" aria-label="Structured mentorship program planning"
    style={{textAlign:'left'}}>
    <h2>6. Structured mentorship programs</h2>
    <p>Choose a guided study track with weekly milestones. You can save a private learning plan and update your own progress. These plans do not assign a mentor, book sessions, grant program admission, or issue a certificate.</p>
    {!advanced && <p className="muted">Your educational level is limited to academic self-study plans. Professional mentoring still requires the separate age and guardian eligibility checks.</p>}
    {error && <p className="banner banner-error" role="alert">{error}</p>}
    {notice && <p className="banner banner-info" role="status">{notice}</p>}
    {loading ? <p role="status">Checking your private program plans…</p> :
      !available && <p role="status">Your existing plans cannot be verified. Saving and status changes are paused to prevent duplicates.</p>}
    {!available && !loading && <button type="button" className="btn btn-secondary" disabled={busy}
      onClick={() => setRevision(n=>n+1)}>Retry my program plans</button>}
    <form onSubmit={savePlan} aria-label="Create a structured learning plan">
      <div className="field"><label htmlFor="mentorship-program-area">Learning area</label>
        <select id="mentorship-program-area" value={area.id} disabled={busy}
          onChange={e=>{setAreaId(e.target.value as AreaId);setNotice('')}}>
          {allowedAreas.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
        </select></div>
      <div className="field"><label htmlFor="mentorship-program-track">Program length</label>
        <select id="mentorship-program-track" value={trackId} disabled={busy}
          onChange={e=>{setTrackId(e.target.value as TrackId);setNotice('')}}>
          {TRACKS.map(item=><option key={item.id} value={item.id}>{item.name} · {item.weeks} weeks</option>)}
        </select></div>
      <h3>{track.name} plan — {track.weeks} weeks</h3>
      <ol>{milestones.map((step,index)=><li key={index}><strong>Week {index+1}:</strong> {step}</li>)}</ol>
      {existing ? <p role="status">You already saved this program plan. Change its status below or open My Mentorship to edit its milestones.</p> : <>
        <div className="field"><label htmlFor="mentorship-program-personal-step">My additional next step (optional)</label>
          <textarea id="mentorship-program-personal-step" maxLength={350} rows={3}
            disabled={busy} value={myNextStep} onChange={e=>setMyNextStep(e.target.value)}
            placeholder="What would make this track useful for your own learning?"/></div>
        <div className="field"><label htmlFor="mentorship-program-target">My target date (optional)</label>
          <input id="mentorship-program-target" type="date" value={targetDate} disabled={busy}
            onChange={e=>setTargetDate(e.target.value)}/></div>
        <button type="submit" className="btn btn-primary" disabled={busy||loading||!available}>
          {busy ? 'Saving program plan…' : 'Save my personal program plan'}
        </button>
      </>}
    </form>
    <h3>My saved program plans</h3>
    {available && savedPlans.length === 0 && <p className="muted">No personal program plans saved yet.</p>}
    {available && savedPlans.length > 0 && <div className="list-panel">
      {savedPlans.map(goal=><article className="list-row" key={goal.id} style={{display:'block'}}>
        <strong>{goal.title}</strong>
        {goal.target_date && <p className="muted">My target date: {goal.target_date}</p>}
        <div className="field"><label htmlFor={'mentorship-program-status-'+goal.id}>Personal progress status</label>
          <select id={'mentorship-program-status-'+goal.id} value={goal.status} disabled={busy}
            onChange={e=>updateStatus(goal,e.target.value as MentorshipGoal['status'])}>
            <option value="planned">Planned</option>
            <option value="in_progress">In progress</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed (self-reported)</option>
          </select></div>
      </article>)}
    </div>}
    {onNavigate && <div style={{display:'flex',gap:'.5rem',flexWrap:'wrap'}}>
      <button type="button" className="btn btn-secondary" onClick={()=>onNavigate(9)}>Open My Mentorship to edit plans</button>
      <button type="button" className="btn btn-secondary" onClick={()=>onNavigate(11)}>Open real mentor assignments</button>
    </div>}
  </section>
}
