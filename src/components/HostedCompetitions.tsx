import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

// Enable only after live server authorization, team uniqueness and age gates pass.
const HOSTED_ENTRY_VERIFIED = import.meta.env.VITE_MELA_STAGING === 'true'

type Kind = 'team_battle' | 'employer_challenge' | 'tournament'
type Competition = { id: string; title: string; description: string | null; status: string; team_mode: boolean; starts_at?: string | null; registration_deadline?: string | null }
const labels = { team_battle: 'Team Battle', employer_challenge: 'Employer Challenge', tournament: 'Tournaments' }
export default function HostedCompetitions({ kind, onBack, onMatch, canEnter }: { kind: Kind; onBack: () => void; onMatch: (id: string) => void; canEnter: boolean }) {
  const entryAllowed=HOSTED_ENTRY_VERIFIED && canEnter
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
            const tournamentIds=data.map(x=>x.id)
            const {data: teams, error: teamError} = await supabase.from('arena_tournament_teams')
              .select('id,tournament_id,join_code').eq('captain_id', auth.user.id)
              .eq('status','active').in('tournament_id',tournamentIds)
            if (teamError) throw teamError
            const {data: ownRegistrations,error:ownError}=await supabase.from('arena_tournament_competitors')
              .select('tournament_id').eq('user_id',auth.user.id)
              .in('tournament_id',tournamentIds).neq('status','withdrawn')
            if(ownError)throw ownError
            const teamIds=(teams??[]).map(x=>x.id)
            const registeredTeamIds=new Set<string>()
            if(teamIds.length){
              const {data: teamRegistrations,error:teamError2}=await supabase.from('arena_tournament_competitors')
                .select('tournament_team_id').in('tournament_team_id',teamIds)
                .neq('status','withdrawn')
              if(teamError2)throw teamError2
              for(const registration of teamRegistrations??[]){
                if(registration.tournament_team_id)registeredTeamIds.add(registration.tournament_team_id)
              }
            }
            if(active){
              setRegistered((ownRegistrations??[]).map(x=>x.tournament_id))
              setCaptainTeams(current=>({...current,...Object.fromEntries(
                (teams??[]).map(team=>[team.tournament_id,{
                  id:team.id,code:team.join_code,registered:registeredTeamIds.has(team.id)
                }])
              )}))
            }
          }
        }
      } catch (cause: any) { if (active) setError(cause.message ?? 'Could not load competitions.') }
      finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [kind, page, revision])

  async function act(action: 'join' | 'create' | 'code', item?: Competition) {
    if (!entryAllowed || lock.current) return
    lock.current = true;setBusy(true);setError('');setNotice('')
    try{
      const requestedAction=action==='code'?'join_code':action==='create'?'create_team':'join'
      const {data,error:apiError}=await supabase.rpc('staging_arena_hosted_join_v1',{
        p_kind:kind,p_action:requestedAction,p_id:item?.id??null,
        p_team_name:teamName.trim()||null,p_join_code:code.trim()||null,
      })
      if(apiError)throw apiError
      if(action==='code'){
        if(kind!=='tournament'&&data?.match_id)onMatch(String(data.match_id))
        else setNotice('Team joined. Your captain must register the tournament team before the deadline.')
        setCode('');return
      }
      if(!item)return
      if(kind==='tournament'){
        if(item.team_mode){
          if(!data?.team_id||!data?.join_code)throw new Error('Staging did not return a tournament team code.')
          setCaptainTeams(old=>({...old,[item.id]:{id:String(data.team_id),code:String(data.join_code),registered:false}}))
          setNotice('Team created, not registered. Share the code privately, then confirm the team registration.')
        }else{
          setRegistered(old=>[...new Set([...old,item.id])])
          setNotice('Individual registration saved. The event organizer decides when matches begin.')
        }
      }else if(item.team_mode){
        setNotice('Team created. Share this code only with teammates: '+String(data?.join_code??'ask the organizer'))
        setRegistered(old=>[...new Set([...old,item.id])])
      }else if(data?.match_id)onMatch(String(data.match_id))
      else throw new Error('The joined match could not be opened.')
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not join this organized competition.')}
    finally{lock.current=false;setBusy(false)}
  }
  return <div className="dash-main">
    <div className="section-heading"><h1>{labels[kind]}</h1><button className="btn btn-secondary" disabled={busy} onClick={onBack}>Back to Arena</button></div>
    <p>Only public events from approved educators or employers can be entered in this adult staging beta. The server rejects unverified organizers, ineligible learners and closed registration. No cash rewards or payouts are enabled.</p>
    {!canEnter&&<p className="notice">Complete the adult student eligibility information in Arena before entering a competition.</p>}
    {error && <p role="alert" className="banner banner-error">{error}<button className="btn btn-secondary" disabled={busy || loading} onClick={() => setRevision(x => x + 1)}>Retry list</button></p>}
    {notice && <p role="status">{notice}</p>}
    {<div className="list-panel">
      <label>Team name<input value={teamName} maxLength={80} disabled={busy} onChange={e => setTeamName(e.target.value)} /></label>
      <label>Team join code<input value={code} maxLength={64} autoComplete="off" disabled={busy} onChange={e => setCode(e.target.value)} /></label>
      <button className="btn btn-secondary" disabled={!entryAllowed || busy || !code.trim()} onClick={() => void act('code')}>Join team by code</button>
    </div>}
    {loading ? <p role="status">Loading competitions…</p> : !items.length ? <p className="empty-panel">No public competitions from approved organizers are available in this category yet.</p> : items.map(item => <article className="list-panel" key={item.id}>
      <h2>{item.title}</h2><p>{item.description}</p><p>{item.status} · {item.team_mode ? 'Team' : 'Individual'}</p>
      {item.starts_at && <p>Starts: {new Date(item.starts_at).toLocaleString()}</p>}
      {item.registration_deadline && <p>Registration closes: {new Date(item.registration_deadline).toLocaleString()}</p>}
      {captainTeams[item.id] && <div><p>Team join code: {captainTeams[item.id].code}</p><button className="btn btn-primary" disabled={!entryAllowed || busy || captainTeams[item.id].registered || item.status !== 'registration'} onClick={async () => {
        if (!entryAllowed || lock.current) return
        lock.current = true; setBusy(true); setError('')
        try { const {error} = await supabase.rpc('staging_arena_hosted_join_v1',{
          p_kind:'tournament',p_action:'register_team',p_id:captainTeams[item.id].id,
          p_team_name:null,p_join_code:null,
        }); if (error) throw error; setCaptainTeams(current => ({...current,[item.id]:{...current[item.id],registered:true}})); setNotice('Team registration confirmed.') }
        catch (cause: any) { setError(cause.message ?? 'Could not register team.') }
        finally { lock.current = false; setBusy(false) }
      }}>{captainTeams[item.id].registered ? 'Team registered' : 'Confirm team registration'}</button></div>}
      {registered.includes(item.id) || captainTeams[item.id] ? <>{kind !== 'tournament' && <button className="btn btn-primary" onClick={() => onMatch(item.id)}>Open match</button>}</> : <button className="btn btn-primary" disabled={!entryAllowed || busy || item.status === 'in_progress' || (item.team_mode && !teamName.trim()) || (!!item.registration_deadline && Date.parse(item.registration_deadline) <= Date.now())} onClick={() => void act(item.team_mode ? 'create' : 'join', item)}>{item.team_mode ? 'Create team' : kind === 'tournament' ? 'Register for tournament' : 'Join match'}</button>}
    </article>)}
    <div className="toolbar"><button className="btn btn-secondary" disabled={page === 0 || loading || busy} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button className="btn btn-secondary" disabled={!hasMore || loading || busy} onClick={() => setPage(p => p + 1)}>Next</button></div>
  </div>
}
