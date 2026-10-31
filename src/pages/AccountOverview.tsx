import type { MelaProfile } from '../lib/auth'
import type { SupabaseClient } from '@supabase/supabase-js'
import SubscriptionPlans from '../components/SubscriptionPlans'
import { SHARED_ACCOUNT_FEATURES, workspaceItems } from '../lib/role-workspaces'

/** Only the authenticated user's loaded profile is displayed; no directory lookups. */
export default function AccountOverview({ profile, onBack, client }: {
  profile: MelaProfile
  client?: SupabaseClient
  onBack: () => void
}) {
  const items = workspaceItems(profile.role)
  return <section className="dash-main" aria-label="My MELA account">
    <span className="eyebrow">MELA · PERSONAL ACCOUNT</span>
    <h1>My account</h1>
    <p className="muted">Your personal information is private. Workspace access depends on your verified role, qualifications and eligibility.</p>
    <div className="list-panel">
      <div className="list-row"><span className="list-row-title">Full name</span><span className="list-row-meta">{profile.full_name || 'Not provided'}</span></div>
      <div className="list-row"><span className="list-row-title">Email</span><span className="list-row-meta">{profile.email || 'Not provided'}</span></div>
      <div className="list-row"><span className="list-row-title">Account role</span><span className="list-row-meta">{profile.role}</span></div>
      <div className="list-row"><span className="list-row-title">Account status</span><span className="list-row-meta">{profile.account_status}</span></div>
      <div className="list-row"><span className="list-row-title">Profile completion</span><span className="list-row-meta">{profile.profile_completion ?? 0}%</span></div>
      <div className="list-row"><span className="list-row-title">Preferred language</span><span className="list-row-meta">{profile.preferred_language}</span></div>
      {profile.role === 'student' && <div className="list-row"><span className="list-row-title">My education level</span><span className="list-row-meta">{profile.grade_level ? `Grade ${profile.grade_level}` : profile.education_stage_key || 'Not selected'}</span></div>}
    </div>
    <div className="section-heading"><h2>Features everyone shares</h2></div>
    <ul className="list-panel">{SHARED_ACCOUNT_FEATURES.map(item => <li key={item}>{item}</li>)}</ul>
    {items.length > 0 && <>
      <div className="section-heading"><h2>My role-specific workspace</h2></div>
      <p className="field-hint">The list describes eligibility, not a guarantee that a feature has been activated or a professional account has been approved.</p>
      <ul className="list-panel">{items.map(item => <li key={item.title}><strong>{item.title}</strong> — {item.requirement}</li>)}</ul>
    </>}
    {client&&<SubscriptionPlans client={client} />}
    <p className="field-hint">Personal records, credentials and children's learning records are never shared with other users simply because they have an account. Verified relationships and backend permissions are required.</p>
    <button type="button" className="btn btn-primary" onClick={onBack}>Back to my workspace</button>{' '}
    <button type="button" className="btn btn-secondary" onClick={() => window.dispatchEvent(new Event('mela:open-settings'))}>Open settings</button>
  </section>
}
