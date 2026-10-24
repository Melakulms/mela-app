import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { safeExternalUrl } from '../lib/external-url'

type University = { id: number; name: string; country: string; website_url: string }

export default function UniversityDirectory() {
  const [rows, setRows] = useState<University[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [country, setCountry] = useState('')
  const [page, setPage] = useState(0)
  const [grade, setGrade] = useState<number | null>(null)
  const [stage, setStage] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void (async () => {
      try {
        const { data: universityRows, error: queryError } = await supabase.from('universities')
          .select('id,name,country,website_url').eq('is_active', true).order('name').range(0, 499)
        if (queryError) throw queryError
        const { data: auth } = await supabase.auth.getUser()
        if (auth.user) {
          const { data: learner } = await supabase.from('profiles')
            .select('grade_level,education_stage_key').eq('id', auth.user.id).maybeSingle()
          if (active) {
            setGrade(typeof learner?.grade_level === 'number' ? learner.grade_level : null)
            setStage(learner?.education_stage_key ?? null)
          }
        }
        if (active) setRows((universityRows ?? []) as University[])
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Directory temporarily unavailable.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [revision])
  const countries = useMemo(() => [...new Set(rows.map(x => x.country))].sort(), [rows])
  const filtered = useMemo(() => rows.filter(x =>
    (!country || x.country === country) &&
    (!search || (x.name + ' ' + x.country).toLowerCase().includes(search.trim().toLowerCase()))
  ), [rows, search, country])
  const visible = filtered.slice(page * 12, (page + 1) * 12)
  const school = stage?.startsWith('school_')
  return <section aria-label="Explore universities">
    <div className="section-heading"><div><h2>Explore global universities</h2>
      <p className="muted">Official university websites from the MELA 200-university research directory.</p>
    </div></div>
    <div className="banner" role="note">
      <strong>University directory — not 200 verified scholarships.</strong>
      <p>University inclusion does not mean the institution has an open scholarship or accepts Ethiopian applicants for funding.
      Scholarship eligibility, funding and deadlines must be checked on an individual official scholarship page.</p>
    </div>
    {school && grade !== null && grade <= 10 && <p className="muted">Grades 1–10: Explore universities for future planning. University degree applications are not yet appropriate.</p>}
    {school && grade !== null && grade >= 11 && <p className="muted">Grades 11–12: Compare admission requirements and prepare documents. MELA's application-submission controls require verified guardian authorization for school learners. Do not share private documents with unofficial agents.</p>}
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRevision(v => v + 1)}>Retry</button></div>}
    <div className="list-panel">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        <input aria-label="Find university" placeholder="Search by university or country" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} />
        <select aria-label="Filter by country" value={country} onChange={e => { setCountry(e.target.value); setPage(0) }}>
          <option value="">All countries</option>{countries.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {loading ? <p role="status">Loading university directory…</p> :
        !error && filtered.length === 0 ? <div className="empty-panel">No universities match this filter.</div> :
        <><p className="muted">{filtered.length} universities listed; official websites only</p>
          {visible.map(u => <div className="list-row" key={u.id}>
            <div style={{ flex: 1 }}><div className="list-row-title">{u.name}</div><div className="list-row-meta">{u.country} · Scholarship details not yet individually verified</div></div>
            {safeExternalUrl(u.website_url) ? <a className="btn btn-secondary" href={safeExternalUrl(u.website_url)!} rel="noopener noreferrer" target="_blank">University website</a> : <span>Link unavailable</span>}
          </div>)}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
            <button className="btn btn-secondary" disabled={page === 0} onClick={() => setPage(v => v - 1)}>Previous</button>
            <span>Page {page + 1} of {Math.max(1, Math.ceil(filtered.length / 12))}</span>
            <button className="btn btn-secondary" disabled={(page + 1) * 12 >= filtered.length} onClick={() => setPage(v => v + 1)}>Next</button>
          </div>
        </>}
    </div>
  </section>
}
