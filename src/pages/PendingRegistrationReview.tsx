/** A verified login credential does not necessarily activate a legacy or
 * professionally restricted account. Never grant roles or change status here.
 */
type Props = {
  role: string
  onRefresh: () => void
  onSignOut: () => void
  onOpenPrivacy?: () => void
}

export default function PendingRegistrationReview({ role, onRefresh, onSignOut, onOpenPrivacy }: Props) {
  const professional = ['teacher', 'mentor', 'employer', 'company', 'partner', 'admin', 'super_admin'].includes(role)
  return <main className="auth-shell"><div className="auth-card" style={{maxWidth:700}}>
    <span className="auth-wordmark">MELA</span>
    <h1>Sign-in verified — account review pending</h1>
    <p className="auth-subtitle" role="status">
      Your sign-in method has been accepted, but your MELA account is still marked as pending.
      You do not need to request another confirmation email.
    </p>
    {professional
      ? <p>Professional and administrator privileges require a separate authorized review. A confirmed contact does not automatically approve qualifications or grant access.</p>
      : <p>If you just registered, use Check account status below. If this status continues, contact MELA support and explain that your account remains pending after verification. Do not create another account.</p>}
    <button className="btn btn-primary btn-block" type="button" onClick={onRefresh}>Check account status</button>
    {onOpenPrivacy && <button className="btn btn-secondary btn-block" type="button" onClick={onOpenPrivacy}>Privacy and data requests</button>}
    <button className="btn btn-secondary btn-block" type="button" onClick={onSignOut}>Sign out</button>
  </div></main>
}
