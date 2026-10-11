import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Enable only after live server authorization, team uniqueness and age gates pass.
const HOSTED_ENTRY_VERIFIED = false

type Kind = 'team_battle' | 'employer_challenge' | 'tournament'
type Competition = { id: string; title: string; description: string | null; status: string; team_mode: boolean; starts_at?: string | null; registration_deadline?: string | null }
const labels = { team_battle: 'Team Battle', employer_challenge: 'Employer Challenge', tournament: 'Tournaments' }
export default function HostedCompetitions({ kind, onBack, onMatch }: { kind: Kind; onBack: () => void; onMatch: (id: string) => void }) {
  const [items, setItems] = useState<Competition[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [teamName, setTeamName] = useState('')
  const [code, setCode] = useState('')
  const [captainTeams, setCaptainTeams] = useState<Record<string, {id: string; code: string; registered: boolean}>>({})
  const [registered, setRegistered] = useState<string[]>([])
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setItems([])
    void (async () => {
      try {
        let query = kind === 'tournament'
          ? supabase.from('arena_tournaments').select('id,title,description,status,team_mode,starts_at,registration_deadline').in('status', ['registration','in_progress'])
          : supabase.from('arena_matches').select('id,title,description,status,team_mode').eq('arena_type', kind).in('status', ['open','ready'])
        const { data, error } = await query.eq('visibility', 'public').order('id').range(page * 20, page * 20 + 20)
        if (error) throw error
        if (active) { setItems((data ?? []).slice(0,20)); setHasMore((data ?? []).length > 20) }
        if (kind === 'tournament' && data?.length) {
          const {data: auth, error: authError} = await supabase.auth.getUser()
          if (authError) throw authError
          if (auth.user) {
            const {data: teams, error: teamError} = await supabase.from('arena_tournament_teams').select('id,tournament_id,join_code').eq('captain_id', auth.user.id).eq('status','active').in('tournament_id', data.map(x => x.id))
            if (teamError) throw teamError
            if (active) setCaptainTeams(current => ({...current, ...Object.fromEntries((teams ?? []).map(team => [team.tournament_id,{id:team.id,code:team.join_code,registered:false}]))}))
          }
        }
      } catch (cause: any) { if (active) setError(cause.message ?? 'Could not load competitions.') }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [kind, page, revision])

  async function act(action: 'join' | 'create' | 'code', item?: Competition) {
    if (!HOSTED_ENTRY_VERIFIED || lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      if (action === 'code') {
        const { data, error } = await supabase.rpc(kind === 'tournament' ? 'join_arena_tournament_team' : 'join_arena_team', { p_join_code: code.trim() })
        if (error) throw error
        if (kind !== 'tournament' && data?.match_id) onMatch(data.match_id)
        else setNotice('Team joined. Your captain must register the team for the tournament.')
        setCode(''); return
      }
      if (!item) return
      if (kind === 'tournament') {
        if (item.team_mode) {
          const { data, error } = await supabase.rpc('create_arena_tournament_team', { p_tournament_id: item.id, p_name: teamName.trim() })
          if (error) throw error
          // Team registration is a separate organizer-controlled stage; do not claim it happened.
          setCaptainTeams(current => ({...current,[item.id]:{id: data.team_id, code: data.join_code, registered: false}}))
          setNotice('Team created. Share the code only with your teammates, then register the team below.')
        } else {
          const { error } = await supabase.rpc('register_arena_tournament', { p_tournament_id: item.id })
          if (error) throw error
          setNotice('Tournament registration saved. The organizer controls the start time.')
        }
        setRegistered(current => [...current, item.id])
      } else if (item.team_mode) {
        const { data, error } = await supabase.rpc('create_arena_team', { p_match_id: item.id, p_name: teamName.trim() })
        if (error) throw error
        setNotice(`Team created. Join code: ${data?.join_code ?? 'ask the organizer'}. Keep this code within your team.`)
        setRegistered(current => [...current, item.id])
      } else {
        const { error } = await supabase.rpc('join_arena', { p_match_id: item.id })
        if (error) throw error
        onMatch(item.id)
      }
    } catch (cause: any) { setError(cause.message ?? 'The competition could not be joined. Your input is preserved.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <div className="dash-main">
    <div className="section-heading"><h1>{labels[kind]}</h1><button className="btn btn-secondary" disabled={busy} onClick={onBack}>Back to Arena</button></div>
    <p>Browse organizer-led competitions. Joining is paused until server-side eligibility, private/invite access and team-membership checks are verified. Cash prizes and payouts are not enabled.</p>
    {error && <p role="alert" className="banner banner-error">{error}<button className="btn btn-secondary" disabled={busy || loading} onClick={() => setRevision(x => x + 1)}>Retry list</button></p>}
    {notice && <p role="status">{notice}</p>}
    {<div className="list-panel">
      <label>Team name<input value={teamName} maxLength={80} disabled={busy} onChange={e => setTeamName(e.target.value)} /></label>
      <label>Team join code<input value={code} maxLength={64} autoComplete="off" disabled={busy} onChange={e => setCode(e.target.value)} /></label>
      <button className="btn btn-secondary" disabled={!HOSTED_ENTRY_VERIFIED || busy || !code.trim()} onClick={() => void act('code')}>Join team by code</button>
    </div>}
    {loading ? <p role="status">Loading competitions…</p> : !items.length ? <p className="empty-panel">No public competitions are currently available in this category. An organizer must publish one first.</p> : items.map(item => <article className="list-panel" key={item.id}>
      <h2>{item.title}</h2><p>{item.description}</p><p>{item.status} · {item.team_mode ? 'Team' : 'Individual'}</p>
      {item.starts_at && <p>Starts: {new Date(item.starts_at).toLocaleString()}</p>}
      {item.registration_deadline && <p>Registration closes: {new Date(item.registration_deadline).toLocaleString()}</p>}
      {captainTeams[item.id] && <div><p>Team join code: {captainTeams[item.id].code}</p><button className="btn btn-primary" disabled={!HOSTED_ENTRY_VERIFIED || busy || captainTeams[item.id].registered || item.status !== 'registration'} onClick={async () => {
        if (!HOSTED_ENTRY_VERIFIED || lock.current) return
        lock.current = true; setBusy(true); setError('')
        try { const {error} = await supabase.rpc('register_arena_tournament_team', {p_team_id: captainTeams[item.id].id}); if (error) throw error; setCaptainTeams(current => ({...current,[item.id]:{...current[item.id],registered:true}})); setNotice('Team registration confirmed.') }
        catch (cause: any) { setError(cause.message ?? 'Could not register team.') }
        finally { lock.current = false; setBusy(false) }
      }}>{captainTeams[item.id].registered ? 'Team registered' : 'Confirm team registration'}</button></div>}
      {registered.includes(item.id) || captainTeams[item.id] ? <>{kind !== 'tournament' && <button className="btn btn-primary" onClick={() => onMatch(item.id)}>Open match</button>}</> : <button className="btn btn-primary" disabled={!HOSTED_ENTRY_VERIFIED || busy || item.status === 'in_progress' || (item.team_mode && !teamName.trim()) || (!!item.registration_deadline && Date.parse(item.registration_deadline) <= Date.now())} onClick={() => void act(item.team_mode ? 'create' : 'join', item)}>{item.team_mode ? 'Create team' : kind === 'tournament' ? 'Register for tournament' : 'Join match'}</button>}
    </article>)}
    <div className="toolbar"><button className="btn btn-secondary" disabled={page === 0 || loading || busy} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button className="btn btn-secondary" disabled={!hasMore || loading || busy} onClick={() => setPage(p => p + 1)}>Next</button></div>
  </div>
}
