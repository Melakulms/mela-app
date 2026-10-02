import { safeExternalUrl } from '../lib/external-url'
import { useEffect, useRef, useState } from 'react'
import { fetchOpenOpportunities, fetchMyApplications, applyToOpportunity, type Opportunity } from '../lib/opportunities'

export default function OpportunityHub({ onBack }: { onBack: () => void }) {
  const lock = useRef(false)
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [applying, setApplying] = useState<string | null>(null)

  const load = () => {
    setError('')
    Promise.all([fetchOpenOpportunities(), fetchMyApplications()])
      .then(([opps, apps]) => {
        setOpportunities(opps)
        setAppliedIds(new Set(apps.map((a) => a.opportunity_id)))
      })
      .catch((e) => setError(e.message ?? 'Could not load opportunities.'))
  }

  useEffect(load, [])

  const apply = async (id: string) => {
    if (lock.current) return
    lock.current = true
    setApplying(id)
    setError('')
    try {
      await applyToOpportunity(id, '')
      setAppliedIds((prev) => new Set(prev).add(id))
    } catch (e: any) {
      setError(e.message ?? 'Could not submit that application.')
    } finally {
      lock.current = false
      setApplying(null)
    }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>Opportunity Hub</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={load}>Retry opportunities</button></div>}
      {!opportunities && !error && <p className="muted">Loading opportunities…</p>}
      {opportunities && opportunities.length === 0 && (
        <div className="empty-panel">No open opportunities right now — check back soon.</div>
      )}
      {opportunities && opportunities.length > 0 && (
        <div className="list-panel">
          {opportunities.map((o) => {
            const applied = appliedIds.has(o.id)
            return (
              <div className="list-row" key={o.id}>
                <div>
                  <div className="list-row-title">{o.title}</div>
                  <div className="list-row-meta">
                    {o.organization_name}{o.location ? ` · ${o.location}` : ''}{o.is_remote ? ' · Remote' : ''}
                    {o.deadline ? ` · Deadline ${o.deadline}` : ''}
                  </div>
                </div>
                {o.application_method === 'external' ? (safeExternalUrl(o.external_url) ? <a className="btn btn-primary" href={safeExternalUrl(o.external_url)!} target="_blank" rel="noopener noreferrer">Official application site</a> : <span>Official link unavailable</span>) : applied ? (
                  <span className="pill">Applied</span>
                ) : (
                  <button className="btn btn-primary" onClick={() => apply(o.id)} disabled={applying !== null}>
                    {applying === o.id ? 'Applying…' : 'Apply'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
