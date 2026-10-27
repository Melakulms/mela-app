import { lazy, Suspense, useEffect, useState } from 'react'
import type { StudentView } from '../hooks/useStudentNavigation'
import { fetchMyMentorshipRequests, fetchMyMentorshipSessions, fetchVerifiedMentors, type Mentor, type MyMentorshipRequest, type MentorshipSession } from '../lib/mentorship'
import { MENTORSHIP_CATEGORIES, matchesCategory, mentorshipTime } from '../lib/mentor-discovery'
import { MENTORSHIP_RESOURCES, mentorshipTemplate } from '../lib/mentorship-resources'
import { supabase } from '../lib/supabase'
const Mentorship = lazy(() => import('./Mentorship'))
const LearnerTools = lazy(() => import('./LearnerTools'))
const sections = [ ['home', 'Mentorship Home'], ['directory', 'Find a Mentor'], ['categories', 'Categories'], ['requests', 'My Requests'], ['sessions', 'My Sessions'], ['goals', 'Goals & Learning Plan'], ['resources', 'Resources'], ['progress', 'Progress & Achievements'] ] as const
type Section = typeof sections[number][0]
type Plan = { title?: string; goal_title?: string; target_date?: string | null }
type Overview = { mentors: Mentor[]; requests: MyMentorshipRequest[]; sessions: MentorshipSession[]; plan: Plan | null; steps: { id: string; title: string; status: string }[] }
export default function MentorshipHub({ onBack, stageKey, preferredLanguage, onNavigate }: { onBack: () => void; stageKey?: string | null; preferredLanguage?: string; onNavigate: (view: StudentView) => void }) {
  const [section, setSection] = useState<Section>('home'), [category, setCategory] = useState('')
  const [data, setData] = useState<Overview | null>(null), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [childBusy, setChildBusy] = useState(false)
  const [resourceNotice, setResourceNotice] = useState('')
  useEffect(() => {
    if (section !== 'home' && section !== 'progress' && section !== 'categories') return
    let active = true
    setError(''); setData(null)
    Promise.all([fetchVerifiedMentors(), fetchMyMentorshipRequests(), fetchMyMentorshipSessions(), supabase.rpc('get_my_mela_next')]).then(([mentors, requests, sessions, planResult]) => {
      if (planResult.error) throw new Error(planResult.error.message)
      const next = planResult.data
      if (!next || typeof next !== 'object') throw new Error('Your learning plan could not be loaded. Please retry.')
      if (active) setData({ mentors, requests, sessions, plan: next.active_plan ?? null, steps: next.steps ?? [] })
    }).catch(e => { if (active) setError(e?.message ?? 'Could not load mentorship. Please retry.') })
    return () => { active = false }
  }, [section, revision])
  const select = (next: Section) => { if (!childBusy) { setSection(next); setResourceNotice('') } }
  const title = sections.find(s => s[0] === section)?.[1]
  const goal = data?.plan?.title ?? data?.plan?.goal_title ?? ''
  const upcoming = (data?.sessions ?? []).filter(s => s.status === 'scheduled' && new Date(s.scheduled_at).getTime() >= Date.now()).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const completed = (data?.sessions ?? []).filter(s => s.status === 'completed')
  const completedSteps = (data?.steps ?? []).filter(s => s.status === 'completed').length
  const download = (id: string) => {
    let url: string | undefined
    try {
      url = URL.createObjectURL(new Blob([mentorshipTemplate(id)], { type: 'text/plain;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `MELA-${id}.txt`; document.body.appendChild(a); a.click(); a.remove()
      const downloadUrl = url; window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      setResourceNotice('Download requested. Check your device downloads for the worksheet.')
    } catch { if (url) URL.revokeObjectURL(url); setResourceNotice('Download could not start. You can read and copy the prompts below.') }
  }
  return <div className="dash-main mentorship-hub">
    <header className="mentorship-hero"><div><span className="pill">MELA MENTORSHIP</span><h1>Guidance into progress</h1><p>Find support. Build a plan. Practise. Reflect on what you can do next.</p></div><button className="btn btn-secondary" onClick={onBack} disabled={childBusy}>Back to Home</button></header>
    <nav className="mentorship-navigation" aria-label="Mentorship sections">{sections.map(([key, label]) => <button key={key} className={`btn ${section === key ? 'btn-primary' : 'btn-secondary'}`} aria-current={section === key ? 'page' : undefined} disabled={childBusy} onClick={() => select(key)}>{label}</button>)}<button className="btn btn-secondary" disabled={childBusy} onClick={() => onNavigate('safety')}>Guardian & Safety Center</button></nav>
    <div className="section-heading"><h2>{title}</h2></div>
    {['home', 'progress', 'categories'].includes(section) && <>
      {error ? <div><p className="banner banner-error" role="alert">{error}</p><button className="btn btn-secondary" onClick={() => setRevision(r => r + 1)}>Retry overview</button></div> : !data ? <p role="status">Loading your mentorship overview…</p> : <>
        {section === 'home' && <>
          <div className="stat-strip"><div><span className="stat-value">{data.mentors.length}</span><span className="stat-label">Verified mentors</span></div><div><span className="stat-value">{data.requests.filter(r => r.status === 'pending').length}</span><span className="stat-label">Pending requests</span></div><div><span className="stat-value">{upcoming.length}</span><span className="stat-label">Upcoming sessions</span></div><div><span className="stat-value">{completed.length}</span><span className="stat-label">Completed sessions</span></div></div>
          <div className="mentorship-columns"><section className="mentorship-panel"><h3>Your current goal</h3><p>{goal || 'Start with one specific learning or career goal.'}</p>{data.plan?.target_date && <p>Target: {data.plan.target_date}</p>}<p>{completedSteps} of {data.steps.length} plan steps completed. This is your self-tracked MELA plan; it is not automatically shared with mentors.</p><button className="btn btn-primary" onClick={() => select('goals')}>{goal ? 'Continue my plan' : 'Create my goal'}</button></section>
          <section className="mentorship-panel"><h3>Your next session</h3>{upcoming[0] ? <><p>{data.requests.find(r => r.id === upcoming[0].request_id)?.topic ?? 'Mentorship session'}</p><p>{mentorshipTime(upcoming[0].scheduled_at)}</p><p>{upcoming[0].duration_min ?? 30} minutes</p><button className="btn btn-primary" onClick={() => select('sessions')}>Review my session</button></> : <><p>No upcoming session is confirmed.</p><button className="btn btn-primary" onClick={() => select('directory')}>Explore verified mentors</button></>}</section></div>
          <section className="mentorship-panel"><h3>Choose your next action</h3><div className="mentorship-navigation"><button className="btn btn-secondary" onClick={() => select('directory')}>Match mentors to my goal</button><button className="btn btn-secondary" onClick={() => select('requests')}>Track my requests</button><button className="btn btn-secondary" onClick={() => select('resources')}>Prepare for a session</button></div></section>
          <p className="muted">Direct mentorship stays restricted for younger learners. Check Guardian & Safety Center for your consent status. Live calling and group programs are not open yet.</p>
        </>}
        {section === 'categories' && <><p>Explore guidance topics. Counts reflect matching words in verified mentors’ profiles; they do not mean a category-specific qualification has been verified. Learner eligibility still applies.</p><div className="mentorship-card-grid">{MENTORSHIP_CATEGORIES.map(c => { const count = data.mentors.filter(m => matchesCategory(m, c.id)).length; return <article className="mentorship-panel" key={c.id}><h3>{c.title}</h3><p>{c.goal}</p><p>{count ? `${count} matching mentor profile${count === 1 ? '' : 's'}` : 'No matching verified mentor profiles yet'}</p><button className="btn btn-secondary" onClick={() => { setCategory(c.id); select('directory') }}>Explore {c.title}</button></article> })}</div></>}
        {section === 'progress' && <><p>Session participation and self-tracked plan steps are separate from verified skills. Attending a session does not automatically earn a credential.</p><section className="mentorship-panel"><h3>Goal progress</h3><p>{goal || 'No active goal yet.'}</p><label htmlFor="mentorship-progress">{completedSteps} of {data.steps.length} steps completed</label><progress id="mentorship-progress" max={Math.max(data.steps.length, 1)} value={completedSteps} /><button className="btn btn-secondary" onClick={() => select('goals')}>Update my plan</button></section><section className="mentorship-panel"><h3>Completed mentorship sessions</h3>{completed.length ? <ul>{completed.map(s => <li key={s.id}><strong>{data.requests.find(r => r.id === s.request_id)?.topic ?? 'Mentorship session'}</strong><p>{mentorshipTime(s.scheduled_at)}</p><p style={{ whiteSpace: 'pre-wrap' }}>{s.notes || 'No follow-up notes recorded.'}</p></li>)}</ul> : <p>No completed sessions recorded.</p>}<button className="btn btn-primary" onClick={() => onNavigate('passport')}>View Career Passport evidence</button></section></>}
      </>}
    </>}
    <Suspense fallback={<p role="status">Loading mentorship tools…</p>}>
      {(section === 'directory' || section === 'requests' || section === 'sessions') && <Mentorship key={section + category} mode={section} initialCategory={category} initialGoal={goal} preferredLanguage={preferredLanguage} stageKey={stageKey} onOpenSafety={() => onNavigate('safety')} onBack={() => select('home')} onBusyChange={setChildBusy} />}
      {section === 'goals' && <><p>Your saved MELA Next plan connects education and career goals across the platform. Nothing here grants mentors access to your private records.</p><LearnerTools onBusyChange={setChildBusy} view="next" onBack={() => select('home')} onNavigate={onNavigate} /></>}
    </Suspense>
    {section === 'resources' && <><p>Read these preparation guides here or download a blank worksheet for offline use. Your answers stay wherever you choose to write them.</p>{resourceNotice && <p role="status">{resourceNotice}</p>}<div className="mentorship-card-grid">{MENTORSHIP_RESOURCES.map(r => <article className="mentorship-panel" key={r.id}><h3>{r.title}</h3><p>{r.description}</p><details><summary>Read worksheet prompts</summary><ol>{r.prompts.map(p => <li key={p}>{p}</li>)}</ol></details><div className="mentorship-navigation"><button className="btn btn-secondary" onClick={() => download(r.id)}>Download {r.title}</button><button className="btn btn-primary" onClick={() => onNavigate(r.route)}>{r.action}</button></div></article>)}</div></>}
  </div>
}
