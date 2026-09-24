type Props = { status: string; companyName?: string | null; onRefresh: () => void; onEdit: () => void }

export default function EmployerApprovalPending({ status, companyName, onRefresh, onEdit }: Props) {
  const normalized = status.toLowerCase()
  const rejected = normalized === 'rejected' || normalized === 'declined'

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="auth-wordmark">MELA</span>
        <h1>{rejected ? 'Company verification needs changes' : 'Company verification is in review'}</h1>
        <p className="auth-subtitle">
          {companyName ? <><strong>{companyName}</strong> has been registered.</> : 'Your employer profile has been registered.'}
          {' '}MELA admin verification is required before employer tools can be used.
        </p>
        <div className="banner banner-info">
          Status: <strong>{status.replaceAll('_', ' ')}</strong>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn-primary btn-block" onClick={onRefresh}>Check status again</button>
          {rejected && <button className="btn btn-secondary btn-block" onClick={onEdit}>Review and resubmit information</button>}
          <button className="btn btn-secondary btn-block" onClick={() => window.location.reload()}>Reload MELA</button>
        </div>
      </div>
    </div>
  )
}
