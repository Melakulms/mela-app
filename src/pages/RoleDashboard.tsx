import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logoutUser } from '../lib/auth'

type Props = { role: 'parent' | 'teacher' | 'mentor'; fullName?: string | null }

type Summary = {
  title: string
  status: string
  stats: { label: string; value: string | number }[]
  details: string[]
}

async function loadRoleSummary(role: Props['role']): Promise<Summary> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Your session has expired. Please log in again.')
  const id = auth.user.id

  if (role === 'parent') {
    const { data, error } = await supabase.from('guardian_relationships')
      .select('id, learner_id, relationship, status, requested_at')
      .eq('guardian_user_id', id)
      .order('requested_at', { ascending: false })
    if (error) throw error
    const rows = data ?? []
    return {
      title: 'Parent & Guardian Dashboard',
      status: 'Connected to your learner relationships',
      stats: [
        { label: 'Learners', value: rows.length },
        { label: 'Verified', value: rows.filter((r) => r.status === 'verified').length },
        { label: 'Pending', value: rows.filter((r) => r.status === 'pending').length },
      ],
      details: rows.slice(0, 5).map((r) => `${r.relationship ?? 'Learner'} · ${r.status}`),
    }
  }

  if (role === 'teacher') {
    const [{ data: profile, error: profileError }, { data: classes, error: classError }] = await Promise.all([
      supabase.from('teacher_profiles').select('qualification, subjects_taught, grade_levels, institution, verification_status').eq('user_id', id).maybeSingle(),
      supabase.from('educator_classrooms').select('id, title, subject, stage_key, active').eq('educator_id', id).order('created_at', { ascending: false }),
    ])
    if (profileError) throw profileError
    if (classError) throw classError
    const rooms = classes ?? []
    return {
      title: 'Teacher Dashboard',
      status: profile?.verification_status ?? 'profile not completed',
      stats: [
        { label: 'Classes', value: rooms.length },
        { label: 'Active classes', value: rooms.filter((r) => r.active).length },
        { label: 'Subjects', value: profile?.subjects_taught?.length ?? 0 },
      ],
      details: rooms.slice(0, 5).map((r) => `${r.title} · ${r.subject ?? r.stage_key ?? 'Classroom'}`),
    }
  }

  const [{ data: mentor, error: mentorError }, { data: requests, error: requestError }] = await Promise.all([
    supabase.from('mentor_profiles').select('headline, organization, years_experience, verified, active').eq('user_id', id).maybeSingle(),
    supabase.from('mentorship_requests').select('id, mentee_id, topic, status, created_at').eq('mentor_id', id).order('created_at', { ascending: false }),
  ])
  if (mentorError) throw mentorError
  if (requestError) throw requestError
  const rows = requests ?? []
  return {
    title: 'Mentor Dashboard',
    status: mentor?.verified ? (mentor.active ? 'Verified and active' : 'Verified but inactive') : 'Verification pending',
    stats: [
      { label: 'Requests', value: rows.length },
      { label: 'Pending', value: rows.filter((r) => r.status === 'pending').length },
      { label: 'Accepted', value: rows.filter((r) => r.status === 'accepted').length },
    ],
    details: rows.slice(0, 5).map((r) => `${r.topic ?? 'Mentorship request'} · ${r.status}`),
  }
}

function MentorActions(){
 const [rows,setRows]=useState<any[]>([]);const [error,setError]=useState('');
 const load=()=>supabase.auth.getUser().then(({data})=>data.user&&supabase.from('mentorship_requests').select('id,mentee_id,topic,status,created_at').eq('mentor_id',data.user.id).order('created_at',{ascending:false}).then(({data,error})=>{if(error)setError(error.message);else setRows(data??[])}));
 useEffect(()=>{load()},[]);
 const decide=(id:string,decision:'accept'|'decline')=>supabase.rpc('respond_mentorship_request',{p_request_id:id,p_decision:decision}).then(({error})=>{if(error)setError(error.message);else load()});
 return <section><div className="section-heading"><h2>Mentorship requests</h2></div>{error&&<div className="banner banner-error">{error}</div>}{rows.length===0?<div className="empty-panel">No mentorship requests.</div>:<div className="list-panel">{rows.map(r=><div className="list-row" key={r.id}><div><b>{r.topic??'Request'}</b><div className="list-row-meta">{r.status}</div></div>{r.status==='pending'&&<span><button className="btn btn-primary" onClick={()=>decide(r.id,'accept')}>Accept</button> <button className="btn btn-secondary" onClick={()=>decide(r.id,'decline')}>Reject</button></span>}</div>)}</div>}</section>
}

function ParentActions(){
 const [result,setResult]=useState<any>(null);const [error,setError]=useState('');
 const create=()=>supabase.rpc('create_parent_link_invite_v35').then(({data,error})=>{if(error)setError(error.message);else setResult(data)});
 return <section><div className="section-heading"><h2>Parent–learner relationship</h2></div>{error&&<div className="banner banner-error">{error}</div>}<p className="muted">Generate a secure invitation for your learner to connect this account.</p><button className="btn btn-primary" onClick={create}>Generate learner invite</button>{result&&<div className="banner banner-info" style={{marginTop:'1rem'}}>Invitation generated. Share it securely with your learner.</div>}</section>
}

export default function RoleDashboard({ role, fullName }: Props) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadRoleSummary(role).then(setSummary).catch((e) => setError(e.message ?? 'Could not load your dashboard.'))
  }, [role])

  if (error) return <div className="dash-main"><div className="banner banner-error">{error}</div><button className="btn btn-secondary" onClick={() => logoutUser()}>Log out</button></div>
  if (!summary) return <div className="centered-loading">Loading your dashboard…</div>

  return (
    <div className="dash-main">
      <div className="dash-greeting">
        <h1>{summary.title}</h1>
        <p className="muted">Welcome, {fullName ?? 'there'}. {summary.status}.</p>
      </div>
      <div className="stat-strip">
        {summary.stats.map((s) => <div key={s.label}><span className="stat-value">{s.value}</span><span className="stat-label">{s.label}</span></div>)}
      </div>
      <div className="section-heading"><h2>Recent activity</h2></div>
      {summary.details.length === 0
        ? <div className="empty-panel">No activity yet. Complete your profile or start using your MELA tools.</div>
        : <div className="list-panel">{summary.details.map((d, i) => <div className="list-row" key={i}><span className="list-row-title">{d}</span></div>)}</div>}
      {role === 'mentor' && <MentorActions />}
      <button className="btn btn-secondary" onClick={() => logoutUser()}>Log out</button>
    </div>
  )
}
