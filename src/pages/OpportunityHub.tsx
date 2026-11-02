import ResourceDirectory from '../components/ResourceDirectory'
import { useSectionDrilldown } from '../hooks/useSectionDrilldown'
import { safeExternalUrl } from '../lib/external-url'
import { useEffect, useRef, useState } from 'react'
import { fetchOpenOpportunities, fetchMyApplications, applyToOpportunity, type Opportunity, type MyApplication } from '../lib/opportunities'
import { useI18n } from '../i18n'

export default function OpportunityHub({ onBack }: { onBack: () => void }) {
  const { t } = useI18n()
  const lock = useRef(false)
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null)
  const [applications, setApplications] = useState<MyApplication[]>([])
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [applying, setApplying] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [focusedId, openDetails, backToList] = useSectionDrilldown('section')
  const [coverNote, setCoverNote] = useState('')
  const [query, setQuery] = useState(''), [type, setType] = useState(''), [scope, setScope] = useState('all')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    Promise.all([fetchOpenOpportunities(), fetchMyApplications()])
      .then(([opps, apps]) => { if (active) { setOpportunities(opps); setApplications(apps) } })
      .catch((cause) => { if (active) setError(cause.message ?? 'Could not load opportunities.') })
    return () => { active = false }
  }, [revision])

  const apply = async (id: string) => {
    if (lock.current || applications.some(a => a.opportunity_id === id)) return
    lock.current = true; setApplying(id); setError(''); setNotice('')
    try {
      await applyToOpportunity(id, coverNote.trim())
      // Confirm a successful write immediately, then refresh the saved application ID/status.
      setApplications(prev => [...prev, { id: `submitted-${id}`, opportunity_id: id, status: 'submitted', submitted_at: new Date().toISOString() }])
      setCoverNote(''); setSelected(null); setNotice('Your application has been submitted.'); setRevision(value => value + 1)
    } catch (cause: any) { setError(cause.message ?? 'Could not submit that application. Your note is preserved for retry.') }
    finally { lock.current = false; setApplying(null) }
  }

  const visible = (opportunities ?? []).filter(o => (!type || o.opportunity_type === type) && (scope !== 'remote' || o.is_remote) && `${o.title} ${o.organization_name ?? ''} ${o.location ?? ''} ${o.summary ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const focused = opportunities?.find(o => o.id === focusedId)
  if (focused) {
    const official = safeExternalUrl(focused.external_url)
    const application = applications.find(a => a.opportunity_id === focused.id)
    const expired = !!focused.deadline && focused.deadline.slice(0, 10) < new Date().toISOString().slice(0, 10)
    return <div className="dash-main">
      <div className="section-heading"><h1>{focused.title}</h1><button className="btn btn-secondary" type="button" disabled={applying !== null} onClick={() => { setSelected(null); backToList() }}>Back to opportunities</button></div>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {notice && <p role="status" className="banner banner-info">{notice}</p>}
      <section className="list-panel" aria-label="Opened opportunity details">
        <p>{focused.organization_name}{focused.location ? ` · ${focused.location}` : ''}{focused.is_remote ? ' · Remote' : ''}{focused.deadline ? ` · Deadline ${focused.deadline}` : ''}</p>
        <p style={{ whiteSpace: 'pre-wrap' }}>{focused.description ?? focused.summary ?? 'No further description has been published.'}</p>
        {focused.employment_type_label && <p>Employment type: {focused.employment_type_label}</p>}
        {focused.education_level && <p>Education: {focused.education_level}</p>}
        {focused.experience_level && <p>Experience: {focused.experience_level}</p>}
        {!!focused.requirements?.length && <><h2>Requirements</h2><ul>{focused.requirements.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
        {!!focused.skills_required?.length && <p>Skills: {focused.skills_required.join(', ')}</p>}
        {focused.application_instructions && <p>Application instructions: {focused.application_instructions}</p>}
        {focused.stipend_or_reward && <p>Reward: {focused.stipend_or_reward}</p>}
        {application && <p role="status">Application status: {application.status.replaceAll('_', ' ')}</p>}
        {expired && <p role="status">Applications closed.</p>}
        {!expired && (focused.application_method === 'external' || focused.application_method === 'both') && (official
          ? <a className="btn btn-secondary" href={official} target="_blank" rel="noopener noreferrer">Official application site</a>
          : <p>Official link unavailable.</p>)}
        {!expired && !application && (focused.application_method === 'mela' || focused.application_method === 'both') &&
          (selected === focused.id ? <form onSubmit={event => { event.preventDefault(); void apply(focused.id) }}>
            <h2>Apply through MELA</h2>
            <div className="field"><label htmlFor="cover-note">Application note (optional)</label><textarea id="cover-note" rows={6} maxLength={5000} value={coverNote} disabled={applying !== null} onChange={e => setCoverNote(e.target.value)} placeholder="Explain your experience and why you are interested." /></div>
            <button type="submit" className="btn btn-primary" disabled={applying !== null}>{applying ? 'Submitting…' : 'Submit application'}</button>
            <button type="button" className="btn btn-secondary" disabled={applying !== null} onClick={() => { setSelected(null); setCoverNote('') }}>Cancel application</button>
          </form> : <button className="btn btn-primary" type="button" onClick={() => setSelected(focused.id)}>Apply through MELA</button>)}
        {!['external', 'both', 'mela'].includes(focused.application_method ?? '') && <p>Application instructions are not available yet.</p>}
      </section>
    </div>
  }
  return <div className="dash-main"><ResourceDirectory />
    <div className="section-heading"><h1>{t('opportunityHub')}</h1><button className="btn btn-secondary" disabled={applying !== null} onClick={onBack}>{t('back')}</button></div>
    {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" disabled={applying !== null} onClick={() => setRevision(value => value + 1)}>Retry opportunities</button></div>}
    {notice && <p role="status">{notice}</p>}
    {!opportunities && !error && <p role="status">Loading opportunities…</p>}
    {opportunities && <>
      <div className="field"><label htmlFor="opportunity-search">Search opportunities</label><input id="opportunity-search" type="search" disabled={selected !== null} value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="field"><label htmlFor="opportunity-type">Opportunity type</label><select id="opportunity-type" value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{Array.from(new Set(opportunities.map(o => o.opportunity_type).filter((value): value is string => !!value))).map(value => <option key={value} value={value}>{value}</option>)}</select></div>
      <div className="field"><label htmlFor="opportunity-scope">Location preference</label><select id="opportunity-scope" value={scope} onChange={e => setScope(e.target.value)}><option value="all">All locations</option><option value="remote">Remote only</option></select></div>
      {!visible.length && <div className="empty-panel">{opportunities.length ? 'No opportunities match these filters.' : 'No open opportunities right now — check back soon.'}</div>}
      <div className="list-panel">{visible.map(o => {
        const application = applications.find(a => a.opportunity_id === o.id)
        const official = safeExternalUrl(o.external_url)
        const expired = !!o.deadline && o.deadline.slice(0, 10) < new Date().toISOString().slice(0, 10)
        return <div className="list-row" key={o.id}><div>
          <h2 className="list-row-title">{o.title}</h2><p className="list-row-meta">{o.organization_name}{o.location ? ` · ${o.location}` : ''}{o.is_remote ? ' · Remote' : ''}{o.deadline ? ` · Deadline ${o.deadline}` : ''}</p>
          <p>{o.summary}</p>
          <button className="btn btn-secondary" type="button" onClick={() => { setSelected(null); openDetails(o.id) }}>View full details</button>
          {o.opportunity_type && <p>Type: {o.opportunity_type}</p>}{o.stipend_or_reward && <p>Reward: {o.stipend_or_reward}</p>}
          {application && <p>Status: {application.status.replaceAll('_', ' ')}</p>}
          {expired ? <span className="pill">Applications closed</span> : <>
            {(o.application_method === 'external' || o.application_method === 'both') && (official ? <a className="btn btn-secondary" href={official} target="_blank" rel="noopener noreferrer">Official application site</a> : <span>Official link unavailable</span>)}
            {(o.application_method === 'mela' || o.application_method === 'both') && !application && <button className="btn btn-primary" disabled={selected !== null || applying !== null} onClick={() => { openDetails(o.id); setSelected(o.id); setCoverNote(''); setError(''); setNotice('') }}>Apply through MELA</button>}
            {!['external', 'both', 'mela'].includes(o.application_method ?? '') && <span>Application instructions are not available yet.</span>}
          </>}
        </div></div>
      })}</div>
    </>}
    <div className="section-heading"><h2>My applications</h2></div>
    {applications.length ? <div className="list-panel">{applications.map(a => <div className="list-row" key={a.id}><div><h3>{opportunities?.find(o => o.id === a.opportunity_id)?.title ?? `Opportunity reference: ${a.opportunity_id}`}</h3><p>Submitted {new Date(a.submitted_at).toLocaleDateString()}</p></div><span className="pill">{a.status.replaceAll('_', ' ')}</span></div>)}</div> : opportunities && <p className="empty-panel">You have not submitted a MELA application yet. Applications on external websites are tracked by their providers.</p>}
  </div>
}
