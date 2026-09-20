import { useEffect, useState } from 'react'
import { fetchOpenScholarships, type Scholarship } from '../lib/scholarships'
import { fetchMyApplications, applyToOpportunity } from '../lib/opportunities'

export default function EthioScholarConnect({ onBack }: { onBack: () => void }) {
  const [scholarships, setScholarships] = useState<Scholarship[] | null>(null)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [applying, setApplying] = useState<string | null>(null)

  const load = () => {
    Promise.all([fetchOpenScholarships(), fetchMyApplications()])
      .then(([scholars, apps]) => {
        setScholarships(scholars)
        setAppliedIds(new Set(apps.map((a) => a.opportunity_id)))
      })
      .catch((e) => setError(e.message ?? 'Could not load scholarships.'))
  }
  useEffect(load, [])

  const apply = async (s: Scholarship) => {
    if (s.application_method === 'external') {
      if (s.external_url) window.open(s.external_url, '_blank', 'noopener,noreferrer')
      else setError('This scholarship requires an external application link, but no official link is available.')
      return
    }
    setApplying(s.id)
    setError('')
    try {
      await applyToOpportunity(s.id, '')
      setAppliedIds((prev) => new Set(prev).add(s.id))
    } catch (e: any) {
      setError(e.message ?? 'Could not submit that application.')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>EthioScholar Connect</h1>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
      </div>
      {error && <div className="banner banner-error">{error}</div>}
      {!scholarships && !error && <p className="muted">Loading scholarships…</p>}
      {scholarships && scholarships.length === 0 && (
        <div className="empty-panel">No currently open scholarships are available.</div>
      )}
      {scholarships && scholarships.length > 0 && (
        <div className="list-panel">
          {scholarships.map((s) => {
            const applied = appliedIds.has(s.id)
            return (
              <div className="list-row" key={s.id}>
                <div>
                  <div className="list-row-title">{s.title}</div>
                  <div className="list-row-meta">
                    {s.institution ?? s.program_name ?? 'Scholarship'}
                    {s.study_country ? ` · ${s.study_country}` : ''}
                    {s.award_amount ? ` · ${s.award_amount} ${s.award_currency ?? ''}` : ''}
                    {s.deadline ? ` · Due ${s.deadline}` : ''}
                  </div>
                  {s.external_url && (
                    <a href={s.external_url} target="_blank" rel="noopener noreferrer" className="muted">
                      Official application link
                    </a>
                  )}
                </div>
                {applied ? (
                  <span className="pill">Applied</span>
                ) : (
                  <button className="btn btn-primary" onClick={() => apply(s)} disabled={applying === s.id}>
                    {applying === s.id ? 'Applying…' : s.application_method === 'external' ? 'Apply externally' : 'Apply'}
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
