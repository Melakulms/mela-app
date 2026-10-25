import { useMemo, useState } from 'react'
import universityCatalog from '../data/university-directory-research.json'
import programmeCatalog from '../data/scholarship-programme-research.json'
import { safeExternalUrl } from '../lib/external-url'

type View = 'universities' | 'programmes'
type University = typeof universityCatalog.universities[number]
type Programme = typeof programmeCatalog.programmes[number]
const PAGE_SIZE = 12

function OfficialSource({ url, label }: { url: string | null; label: string }) {
  const safe = safeExternalUrl(url)
  return safe
    ? <a className="btn btn-secondary" href={safe} target="_blank" rel="noopener noreferrer">{label}</a>
    : <span className="muted">Official source unavailable</span>
}

function DeadlineNote({ programme }: { programme: Programme }) {
  const now = new Date().toISOString().slice(0, 10)
  let message = 'Deadline not confirmed — check the official source'
  if (programme.deadline_status === 'school_nomination_closed') {
    message = 'School nomination closed for the researched cycle'
  } else if (programme.deadline_status === 'provider_not_open') {
    message = 'Application window was not yet published when checked'
  } else if (programme.closes_on && programme.closes_on < now) {
    message = 'The researched closing date has passed'
  } else if (programme.opens_on && programme.opens_on > now) {
    message = 'Research listed an opening date of ' + programme.opens_on
  } else if (programme.closes_on) {
    message = 'Research listed a closing date of ' + programme.closes_on
  }
  return <p className="list-row-meta"><strong>{message}</strong> · Reconfirm current cycle and timezone</p>
}

export default function ScholarshipResearchLibrary({ view }: { view: View }) {
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('')
  const [fundingOnly, setFundingOnly] = useState(false)
  const [level, setLevel] = useState('')
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const universityRows: University[] = universityCatalog.universities
  const programmes: Programme[] = programmeCatalog.programmes
  const countries = useMemo(() => [...new Set(
    (view === 'universities' ? universityRows : programmes).map(item => item.country),
  )].sort(), [view])

  const universityResults = useMemo(() => universityRows.filter(item => (
    (!query || (item.name + ' ' + item.country).toLowerCase().includes(query.trim().toLowerCase())) &&
    (!country || item.country === country) &&
    (!fundingOnly || item.funding.length > 0)
  )), [query, country, fundingOnly])

  const programmeResults = useMemo(() => programmes.filter(item => (
    (!query || (item.title + ' ' + item.country + ' ' + item.funding_summary).toLowerCase().includes(query.trim().toLowerCase())) &&
    (!country || item.country === country) &&
    (!level || item.degree_level === level || item.degree_level === 'mixed')
  )), [query, country, level])

  const resultsCount = view === 'universities' ? universityResults.length : programmeResults.length
  const pageCount = Math.max(1, Math.ceil(resultsCount / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const start = currentPage * PAGE_SIZE
  const resetPage = () => { setPage(0); setExpanded(null) }

  return <section className="list-panel" aria-label={view === 'universities' ? '200 university research links' : 'Scholarship programme research'}>
    <div className="section-heading">
      <div>
        {view === 'universities' ? <>
          <h2>Explore 200 universities</h2>
          <p className="muted">Browse {universityRows.length} university website links across {countries.length} countries, including {universityRows.reduce((n, item) => n + item.funding.length, 0)} funding-information pages.</p>
        </> : <>
          <h2>Official programme research</h2>
          <p className="muted">{programmes.length} researched scholarship and financial-aid programme sources, recorded on 24 October 2026.</p>
        </>}
      </div>
    </div>
    <div className="banner banner-info" role="note">
      <strong>{view === 'universities' ? 'A university link is NOT an available scholarship' : 'Research sources, NOT MELA-approved scholarship offers'}</strong>
      <p>{view === 'universities'
        ? 'These university websites and funding-information links came from a dated MELA research directory. Their current availability, individual awards, deadlines, and Ethiopian eligibility have not all been independently rechecked.'
        : 'The research was collected on 24 October 2026. Some applications may be closed, not yet open or subject to changed criteria. A researched page is never a guaranteed scholarship, verified eligibility, application or admission.'}
      </p>
      <p>Do not send identity documents or money to unverified agencies. Use official provider websites to confirm every requirement and current deadline.</p>
    </div>
    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
      <input aria-label="Search research links" placeholder="Search institution, country or programme…" value={query} onChange={event=>{setQuery(event.target.value);resetPage()}} />
      <select aria-label="Research country" value={country} onChange={event=>{setCountry(event.target.value);resetPage()}}>
        <option value="">All countries</option>
        {countries.map(value=><option value={value} key={value}>{value}</option>)}
      </select>
      {view === 'universities'
        ? <label style={{display:'flex',alignItems:'center',gap:8}}><input type="checkbox" checked={fundingOnly} onChange={event=>{setFundingOnly(event.target.checked);resetPage()}} />Show funding links only</label>
        : <select aria-label="Research study level" value={level} onChange={event=>{setLevel(event.target.value);resetPage()}}>
          <option value="">All study levels</option>
          <option value="undergraduate">Undergraduate</option>
          <option value="masters">Master's</option>
          <option value="phd">PhD</option>
          <option value="mixed">Multiple study levels</option>
        </select>}
    </div>
    <p className="muted" role="status">Showing {resultsCount} {view === 'universities' ? 'university links' : 'research programmes'} · Page {currentPage + 1} of {pageCount}</p>
    {resultsCount === 0 && <div className="empty-panel">No entries match these filters. Try another country or clear the search.</div>}
    {view === 'universities'
      ? universityResults.slice(start, start + PAGE_SIZE).map(item=><article className="list-row" key={item.id} style={{display:'block'}}>
          <h3 className="list-row-title">{item.name}</h3>
          <p className="list-row-meta">{item.country} · University research listing, not a current scholarship award</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><OfficialSource url={item.website_url} label="University website" />
            {item.funding.map(source=><OfficialSource key={source.url} url={source.url} label={'Funding information'+(source.levels?' · '+source.levels:'')} />)}
          </div>
        </article>)
      : programmeResults.slice(start, start + PAGE_SIZE).map(item=><article className="list-row" key={item.program_key} style={{display:'block'}}>
          <h3 className="list-row-title">{item.title}</h3>
          <p className="list-row-meta">{item.country} · {item.degree_level} · Research cycle: {item.cycle}</p>
          <DeadlineNote programme={item}/>
          <p><strong>Funding research:</strong> {item.funding_summary}</p>
          <p className="muted"><strong>Nationality research:</strong> {item.nationality_evidence}. Not a verified decision about an individual learner.</p>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            <OfficialSource url={item.scholarship_url} label="Official programme source" />
            {item.application_url && <OfficialSource url={item.application_url} label="Official application instructions" />}
            <button type="button" className="btn btn-secondary" aria-expanded={expanded===item.program_key} onClick={()=>setExpanded(expanded===item.program_key?null:item.program_key)}>Requirements and preparation</button>
          </div>
          {expanded===item.program_key && <div>
            <p><strong>Conditions to check:</strong></p>
            <ul>{item.essential_requirements.map((condition,i)=><li key={i}>{condition}</li>)}</ul>
            <p><strong>Suggested preparation:</strong></p>
            <ol>{item.application_steps.map((step,i)=><li key={i}>{step}</li>)}</ol>
            {item.notes && <p className="muted">Research note: {item.notes}</p>}
            <p className="muted">This is research guidance only. It does not save an application or confirm eligibility.</p>
          </div>}
        </article>)}
    {resultsCount > PAGE_SIZE && <nav aria-label="Research page navigation" style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',marginTop:16}}>
      <button className="btn btn-secondary" disabled={currentPage===0} onClick={()=>{setPage(p=>Math.max(0,p-1));setExpanded(null)}}>Previous</button>
      <span className="muted">{currentPage+1} / {pageCount}</span>
      <button className="btn btn-secondary" disabled={currentPage>=pageCount-1} onClick={()=>{setPage(p=>p+1);setExpanded(null)}}>Next</button>
    </nav>}
  </section>
}
