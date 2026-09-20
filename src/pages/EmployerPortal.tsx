import { useEffect, useState } from 'react'
import {
  fetchMyRegistrationRequest, submitRegistration, fetchMyEmployer, fetchMyOpportunities,
  createOpportunity, fetchApplicants,
  type MyEmployerRequest, type MyEmployer, type MyOpportunity, type Applicant,
} from '../lib/employer'

export default function EmployerPortal({ role }: { role: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [request, setRequest] = useState<MyEmployerRequest | null>(null)
  const [employer, setEmployer] = useState<MyEmployer | null>(null)
  const [opportunities, setOpportunities] = useState<MyOpportunity[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [viewingApplicants, setViewingApplicants] = useState<string | null>(null)
  const [applicants, setApplicants] = useState<Applicant[] | null>(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      if (role === 'employer') {
        const emp = await fetchMyEmployer()
        setEmployer(emp)
        if (emp) setOpportunities(await fetchMyOpportunities(emp.id))
      } else {
        setRequest(await fetchMyRegistrationRequest())
      }
    } catch (e: any) {
      setError(e.message ?? 'Could not load your employer account.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [role])

  const openApplicants = async (opportunityId: string) => {
    setViewingApplicants(opportunityId)
    setApplicants(null)
    try {
      setApplicants(await fetchApplicants(opportunityId))
    } catch (e: any) {
      setError(e.message ?? 'Could not load applicants.')
    }
  }

  if (loading) return <div className="centered-loading">Loading your employer account…</div>

  if (role !== 'employer') {
    if (!request) return <RegistrationForm onSubmitted={load} error={error} />
    return (
      <div className="dash-main">
        <h1>Employer application</h1>
        {request.status === 'pending' || request.status === 'under_review' ? (
          <div className="banner banner-info">
            Your application for <strong>{request.company_name}</strong> is under review. You'll be able to post opportunities once an admin approves it.
          </div>
        ) : request.status === 'rejected' ? (
          <div className="banner banner-error">
            Your application for {request.company_name} wasn't approved.{request.review_notes ? ` Reason: ${request.review_notes}` : ''}
          </div>
        ) : (
          <div className="banner banner-info">Application status: {request.status}</div>
        )}
      </div>
    )
  }

  if (!employer) {
    return <div className="dash-main"><div className="banner banner-error">{error || 'Your employer account could not be found.'}</div></div>
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{employer.company_name}</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Post an opportunity</button>
      </div>
      {!employer.verified && (
        <div className="banner banner-info">Your company isn't verified yet — opportunities you post still go through moderation before students can see them.</div>
      )}
      {error && <div className="banner banner-error">{error}</div>}

      {showCreate && (
        <CreateOpportunityForm
          onCancel={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
          employerId={employer.id}
        />
      )}

      <div className="section-heading"><h2>Your opportunities</h2></div>
      {opportunities.length === 0 ? (
        <div className="empty-panel">You haven't posted anything yet.</div>
      ) : (
        <div className="list-panel">
          {opportunities.map((o) => (
            <div className="list-row" key={o.id}>
              <div>
                <div className="list-row-title">{o.title}</div>
                <div className="list-row-meta">{o.status} · moderation: {o.moderation_status}</div>
              </div>
              <button className="btn btn-secondary" onClick={() => openApplicants(o.id)}>View applicants</button>
            </div>
          ))}
        </div>
      )}

      {viewingApplicants && (
        <>
          <div className="section-heading"><h2>Applicants</h2></div>
          {!applicants && <p className="muted">Loading…</p>}
          {applicants && applicants.length === 0 && <div className="empty-panel">No applications yet.</div>}
          {applicants && applicants.length > 0 && (
            <div className="list-panel">
              {applicants.map((a) => (
                <div className="list-row" key={a.id}>
                  <div>
                    <div className="list-row-title">{a.full_name ?? 'Applicant'}</div>
                    <div className="list-row-meta">{a.email}</div>
                  </div>
                  <span className="pill">{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function RegistrationForm({ onSubmitted, error: parentError }: { onSubmitted: () => void; error: string }) {
  const [companyName, setCompanyName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [industry, setIndustry] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await submitRegistration({ companyName, legalName, contactEmail, industry, description })
      onSubmitted()
    } catch (e: any) {
      setError(e.message ?? 'Could not submit your application.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dash-main">
      <h1>Register your company</h1>
      <p className="muted">An admin reviews every application before you can post opportunities.</p>
      {(error || parentError) && <div className="banner banner-error">{error || parentError}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Company name</label><input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
        <div className="field"><label>Legal name</label><input required value={legalName} onChange={(e) => setLegalName(e.target.value)} /></div>
        <div className="field"><label>Contact email</label><input type="email" required value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></div>
        <div className="field"><label>Industry</label><input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
        <div className="field"><label>Description</label><input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'}</button>
      </form>
    </div>
  )
}

function CreateOpportunityForm({ employerId, onCreated, onCancel }: { employerId: string; onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [opportunityType, setOpportunityType] = useState('job')
  const [location, setLocation] = useState('')
  const [deadline, setDeadline] = useState('')
  const [summary, setSummary] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await createOpportunity(employerId, { title, opportunityType, location, deadline, summary })
      onCreated()
    } catch (e: any) {
      setError(e.message ?? 'Could not post that opportunity.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="list-panel" style={{ padding: '1.1rem', marginBottom: '2rem' }}>
      <h3>New opportunity</h3>
      {error && <div className="banner banner-error">{error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Title</label><input required value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field">
          <label>Type</label>
          <select value={opportunityType} onChange={(e) => setOpportunityType(e.target.value)}>
            <option value="job">Job</option>
            <option value="internship">Internship</option>
            <option value="training">Training</option>
            <option value="volunteer">Volunteer</option>
          </select>
        </div>
        <div className="field"><label>Location</label><input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
        <div className="field"><label>Deadline</label><input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></div>
        <div className="field"><label>Summary</label><input value={summary} onChange={(e) => setSummary(e.target.value)} /></div>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Posting…' : 'Submit for review'}</button>
        <button className="btn btn-secondary" type="button" onClick={onCancel} style={{ marginLeft: '0.6rem' }}>Cancel</button>
      </form>
    </div>
  )
}
