import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { safeExternalUrl } from '../lib/external-url'

type Programme = {
  id: number
  title: string
  country: string
  degree_level: 'undergraduate' | 'masters' | 'phd' | 'mixed'
  scholarship_url: string
  application_url: string | null
  nationality_evidence: string
  ethiopian_eligibility: 'explicit' | 'international_general' | 'unverified'
  funding_summary: string
  coverage: string[]
  essential_requirements: string[]
  application_steps: string[]
  opens_on: string | null
  closes_on: string | null
  deadline_status: 'dated' | 'unknown' | 'school_nomination_closed' | 'provider_not_open'
  cycle: string
  evidence_checked_on: string
  admin_approved_at: string | null
  notes: string | null
}
const titleForLevel: Record<string,string> = { undergraduate: "Bachelor's / Grade 12 leavers", masters: "Master's (after bachelor's)", phd: 'PhD', mixed: 'Multiple degree levels' }
function deadlineText(p: Programme, today: string): string {
  if (p.deadline_status === 'school_nomination_closed') return 'School nomination closed — only previously nominated students can continue'
  if (p.deadline_status === 'provider_not_open') return '2027 application instructions not yet published'
  if (!p.closes_on) return 'No confirmed deadline — check official source'
  if (p.closes_on < today) return 'Scholarship application deadline passed'
  if (p.opens_on && p.opens_on > today) return 'Opens ' + p.opens_on
  return 'Closing ' + p.closes_on + ' (check official timezone)'
}
export default function ScholarshipResearchPrograms() {
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [saved, setSaved] = useState<Set<number>>(new Set())
  const [level, setLevel] = useState('all')
  const [country, setCountry] = useState('all')
  const [query, setQuery] = useState('')
  const [showSaved, setShowSaved] = useState(false)
  const [busy, setBusy] = useState<number|null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const today = new Date().toISOString().slice(0,10)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const { data, error: programmesError } = await supabase.from('mela_scholarship_program_research')
          .select('id,title,country,degree_level,scholarship_url,application_url,nationality_evidence,ethiopian_eligibility,funding_summary,coverage,essential_requirements,application_steps,opens_on,closes_on,deadline_status,cycle,evidence_checked_on,admin_approved_at,notes')
          .eq('research_state','source_checked').order('closes_on',{ascending:true,nullsFirst:false}).limit(100)
        if (programmesError) throw programmesError
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        let favouriteIds: number[] = []
        if (auth.user) {
          const { data: favourites, error: favouriteError } = await supabase.from('mela_scholarship_research_saved')
            .select('program_id').eq('user_id', auth.user.id)
          if (favouriteError) throw favouriteError
          favouriteIds = (favourites ?? []).map(p => Number(p.program_id))
        }
        if (active) { setProgrammes((data ?? []) as Programme[]); setSaved(new Set(favouriteIds)) }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Scholarship research is currently unavailable.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [version])
  const countries = useMemo(() => [...new Set(programmes.map(p => p.country))].sort(),[programmes])
  const filtered = useMemo(() => programmes.filter(p =>
    (level === 'all' || p.degree_level === level || p.degree_level === 'mixed') &&
    (country === 'all' || p.country === country) &&
    (!showSaved || saved.has(p.id)) &&
    (!query || (p.title+' '+p.country+' '+p.funding_summary).toLowerCase().includes(query.trim().toLowerCase()))
  ).sort((a,b) => Number(Boolean(b.closes_on && b.closes_on >= today))-Number(Boolean(a.closes_on && a.closes_on >= today))), [programmes,level,country,query,saved,showSaved,today])
  const toggleSave = async (p: Programme) => {
    if (busy !== null) return
    setBusy(p.id); setError('')
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Sign in to save scholarships.')
      if (saved.has(p.id)) {
        const { error } = await supabase.from('mela_scholarship_research_saved').delete()
          .eq('user_id',auth.user.id).eq('program_id',p.id)
        if (error) throw error
        setSaved(old => { const n=new Set(old);n.delete(p.id);return n })
      } else {
        const { error } = await supabase.from('mela_scholarship_research_saved').insert({user_id:auth.user.id,program_id:p.id})
        if (error) throw error
        setSaved(old => new Set([...old,p.id]))
      }
    } catch (cause) {setError(cause instanceof Error ? cause.message : 'Unable to save scholarship')}
    finally { setBusy(null) }
  }
  return <section className="list-panel" aria-label="Source-checked scholarship programmes">
    <div className="section-heading"><div>
      <h2>Scholarship programmes researched for Ethiopian applicants</h2>
      <p className="muted">Specific official university awards, checked for nationality eligibility, funding and deadlines.</p>
    </div></div>
    <div className="banner" role="note"><strong>Research, not admission or a scholarship award.</strong>
      <p>Official sources have been checked by MELA research. A listed programme is not necessarily open today, does not guarantee you qualify, and has not been approved as an application by MELA administration. Check every current requirement on the university website. MELA does not charge scholarship application or agent fees.</p>
    </div>
    {error && <div className="banner banner-error" role="alert">{error} <button className="btn btn-secondary" onClick={() => setVersion(v=>v+1)}>Reload</button></div>}
    <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
      <input aria-label="Search source-checked programmes" placeholder="Programme, country or funding" value={query} onChange={e=>setQuery(e.target.value)} />
      <select aria-label="Degree level" value={level} onChange={e=>setLevel(e.target.value)}>
        <option value="all">Every study level</option><option value="undergraduate">Bachelor's</option><option value="masters">Master's</option><option value="phd">PhD</option><option value="mixed">Multiple levels</option>
      </select>
      <select aria-label="Scholarship country" value={country} onChange={e=>setCountry(e.target.value)}>
        <option value="all">All countries</option>{countries.map(c=><option key={c} value={c}>{c}</option>)}
      </select>
      <button className="btn btn-secondary" onClick={()=>setShowSaved(!showSaved)} aria-pressed={showSaved}>{showSaved?'Show all':'Saved only'} ({saved.size})</button>
    </div>
    {loading ? <p role="status">Loading official scholarship research…</p> :
      <><p className="muted">{filtered.length} source-checked programmes. Research as of 24 October 2026; review each official page again before applying.</p>
        {filtered.length === 0 && <div className="empty-panel">No programmes match your filters. The 200-university directory has more leads to explore.</div>}
        {filtered.map(p=><article key={p.id} className="list-row" style={{display:'block'}}>
          <h3 className="list-row-title">{p.title}</h3>
          <p className="list-row-meta">{p.country} · {titleForLevel[p.degree_level] || p.degree_level} · {p.cycle}</p>
          <p><strong>{deadlineText(p,today)}</strong></p>
          <p><strong>Funding:</strong> {p.funding_summary}</p>
          <p><strong>Ethiopian applicants:</strong> {p.nationality_evidence}</p>
          <p className="muted">{p.ethiopian_eligibility === 'explicit'?'Ethiopia explicitly named by provider':'International eligibility indicated — confirm country-specific details'}</p>
          <details><summary>Entry requirements, costs and application steps</summary>
            <p><strong>Coverage</strong></p><ul>{p.coverage.map(x=><li key={x}>{x}</li>)}</ul>
            <p><strong>Requirements</strong></p><ul>{p.essential_requirements.map(x=><li key={x}>{x}</li>)}</ul>
            <p><strong>Next steps</strong></p><ol>{p.application_steps.map(x=><li key={x}>{x}</li>)}</ol>
            {p.notes && <p className="muted">{p.notes}</p>}
          </details>
          <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center',marginTop:12}}>
            {safeExternalUrl(p.scholarship_url) && <a className="btn btn-primary" href={safeExternalUrl(p.scholarship_url)!} target="_blank" rel="noopener noreferrer">University scholarship rules</a>}
            {safeExternalUrl(p.application_url) && p.deadline_status === 'dated' && p.opens_on && p.opens_on <= today && p.closes_on && p.closes_on >= today &&
              <a className="btn btn-secondary" href={safeExternalUrl(p.application_url)!} target="_blank" rel="noopener noreferrer">Official application portal</a>}
            <button className="btn btn-secondary" disabled={busy!==null} onClick={()=>void toggleSave(p)}>{saved.has(p.id)?'Unsave':'Save for later'}</button>
          </div>
          <p className="muted">Evidence reviewed {p.evidence_checked_on}{p.admin_approved_at?' · MELA administrator reviewed':' · Research lead, not administrator-approved'}. No application status is inferred.</p>
        </article>)}</>}
  </section>
}
