import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { safeExternalUrl } from '../lib/external-url'
import { educationReadiness, preliminaryScholarshipMatch, type ScholarshipAcademicProfile } from '../lib/scholarship-readiness'

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
const PREPARATION_STEPS = [
  { key:'check_eligibility',label:'I checked the university’s current eligibility rules' },
  { key:'review_admission',label:'I reviewed admission and nomination requirements' },
  { key:'prepare_documents',label:'I prepared the required documents privately' },
  { key:'review_official_portal',label:'I visited the official university application instructions' },
] as const
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
  const [progress, setProgress] = useState<Record<number,string[]>>({})
  const [academicProfile,setAcademicProfile] = useState<ScholarshipAcademicProfile|null>(null)
  const [academicDocuments,setAcademicDocuments] = useState(0)
  const [readinessError,setReadinessError] = useState('')
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
        let localAcademicProfile: ScholarshipAcademicProfile|null=null
        let verifiedAcademicEvidence=0
        let localReadinessError=''
        const progressByProgramme: Record<number,string[]> = {}
        if (auth.user) {
          const {data: basic,error:basicError}=await supabase.from('profiles')
            .select('role,full_name,education_stage_key,education_onboarding_completed,grade_level,major,graduation_year,email_verified,phone_verified')
            .eq('id',auth.user.id).maybeSingle()
          if(basicError)localReadinessError='Education profile unavailable for matching. Browsing is still allowed.'
          else localAcademicProfile=(basic??null) as ScholarshipAcademicProfile|null
          const {data: evidence,error:evidenceError}=await supabase.from('profile_documents')
            .select('document_type,verified').eq('user_id',auth.user.id).eq('verified',true)
          if(evidenceError)localReadinessError='Academic documents could not be checked; no verified evidence is assumed.'
          else verifiedAcademicEvidence=(evidence??[]).filter(d=>
            ['academic_transcript','transcript','degree_certificate','degree','school_result','academic_record','grade_report'].includes(String(d.document_type).toLowerCase())
          ).length
          const { data: favourites, error: favouriteError } = await supabase.from('mela_scholarship_research_saved')
            .select('program_id').eq('user_id', auth.user.id)
          if (favouriteError) throw favouriteError
          favouriteIds = (favourites ?? []).map(p => Number(p.program_id))
          const { data: preparation, error: progressError } = await supabase.from('mela_scholarship_research_progress')
            .select('program_id,step_key,completed').eq('user_id',auth.user.id).eq('completed',true)
          if (progressError) throw progressError
          for (const task of preparation ?? []) {
            const id=Number(task.program_id)
            progressByProgramme[id]=[...(progressByProgramme[id]??[]),String(task.step_key)]
          }
        }
        if (active) { setProgrammes((data ?? []) as Programme[]); setSaved(new Set(favouriteIds));setProgress(progressByProgramme);setAcademicProfile(localAcademicProfile);setAcademicDocuments(verifiedAcademicEvidence);setReadinessError(localReadinessError) }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Scholarship research is currently unavailable.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [version])
  const readiness = educationReadiness(academicProfile)
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
  const togglePreparation = async(programmeId:number,stepKey:string,completed:boolean) => {
    if (busy !== null) return
    setBusy(programmeId);setError('')
    try {
      const { data: auth,error:authError } = await supabase.auth.getUser()
      if(authError) throw authError
      if(!auth.user) throw new Error('Sign in to save your preparation progress')
      const { error:saveError } = await supabase.from('mela_scholarship_research_progress').upsert({
        user_id:auth.user.id,program_id:programmeId,step_key:stepKey,completed,
        updated_at:new Date().toISOString(),
      },{onConflict:'user_id,program_id,step_key'})
      if(saveError) throw saveError
      setProgress(old=>{
        const next=new Set(old[programmeId]??[])
        if(completed)next.add(stepKey)
        else next.delete(stepKey)
        return {...old,[programmeId]:[...next]}
      })
    }catch(cause){setError(cause instanceof Error?cause.message:'Could not save preparation checklist')}
    finally{setBusy(null)}
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
    <section className="list-panel" aria-label="Your scholarship information readiness" style={{marginBottom:16}}>
      <h3>Your scholarship readiness — information provided, NOT approval</h3>
      <p><strong>{readiness.completed} of {readiness.total}</strong> general profile checks completed.
        <strong> {academicDocuments}</strong> independently verified academic document{academicDocuments===1?'':'s'} recorded.</p>
      <progress value={readiness.completed} max={readiness.total} aria-label="Basic profile completeness" style={{width:'100%'}}/>
      {readinessError&&<p role="alert">{readinessError}</p>}
      {readiness.checks.filter(x=>!x.complete).length>0 ? <>
        <p className="muted">Before personalized matching, finish these items in your MELA profile:</p>
        <ul>{readiness.checks.filter(x=>!x.complete).map(x=><li key={x.key}>{x.label}</li>)}</ul>
      </> : <p className="muted">Your basic education information is present. MELA still cannot confirm your scholarship eligibility.</p>}
      <p className="muted">Nationality/residency, exact entry requirements, English-language evidence and applicable academic records require separate checking. Existing MELA registration does not establish them. A document-upload service is not currently configured on staging: do not submit passports, transcripts or ID images through unofficial links.</p>
      <p className="muted">A recommendation cannot be called an eligible match until these checks are complete. For now, this page provides scholarship research suggestions, not assured matches.</p>
    </section>
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
          <p><strong>Preliminary fit:</strong> {preliminaryScholarshipMatch(academicProfile,p.degree_level,academicDocuments).label}</p>
          <details><summary>What MELA still needs before recommending this to you</summary>
            <ul>{preliminaryScholarshipMatch(academicProfile,p.degree_level,academicDocuments).reasons.map(x=><li key={x}>{x}</li>)}</ul>
            <p className="muted">Do not assume that an official university link or this preliminary comparison confirms scholarship eligibility.</p>
          </details>
          <p><strong>{deadlineText(p,today)}</strong></p>
          <p><strong>Funding:</strong> {p.funding_summary}</p>
          <p><strong>Ethiopian applicants:</strong> {p.nationality_evidence}</p>
          <p className="muted">{p.ethiopian_eligibility === 'explicit'?'Ethiopia explicitly named by provider':'International eligibility indicated — confirm country-specific details'}</p>
          <details><summary>My self-reported preparation ({(progress[p.id]??[]).length}/{PREPARATION_STEPS.length} steps)</summary>
            <p className="muted">This checklist records only what you say you have prepared. Even all boxes checked means ZERO verified application or award progress. MELA has not submitted an application or verified any status with a university. No personal documents are stored here.</p>
            <progress aria-label="Preparation complete" value={(progress[p.id]??[]).length} max={PREPARATION_STEPS.length} style={{width:'100%'}}/>
            {PREPARATION_STEPS.map(step=><label key={step.key} style={{display:'flex',gap:8,alignItems:'center',marginTop:10}}>
              <input type="checkbox" disabled={busy!==null} checked={(progress[p.id]??[]).includes(step.key)}
                onChange={e=>void togglePreparation(p.id,step.key,e.target.checked)}/>{step.label}
            </label>)}
          </details>
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
