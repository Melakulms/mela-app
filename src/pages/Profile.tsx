import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import { fetchEnabledLanguages, type PlatformLanguage } from '../lib/languages'
import { updatePreferredLanguage, logoutUser, type MelaProfile } from '../lib/auth'

export default function Profile({ profile, onProfileUpdated }: { profile: MelaProfile; onProfileUpdated: () => void }) {
  const [languages, setLanguages] = useState<PlatformLanguage[]>([])
  const [linkCode, setLinkCode] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchEnabledLanguages().then(setLanguages).catch(() => {})
  }, [])

  const changeLanguage = async (code: string) => {
    setSaving(true)
    setError('')
    try {
      await updatePreferredLanguage(code)
      onProfileUpdated()
    } catch (e: any) {
      setError(e.message ?? 'Could not update your language.')
    } finally {
      setSaving(false)
    }
  }

  const createParentLink = async () => {
    setLinkBusy(true); setError('')
    try {
      const { data, error } = await supabase.rpc('create_parent_link_invite_v35')
      if (error) throw error
      if (typeof data !== 'string' || !data) throw new Error('No link code was returned. Please retry.')
      setLinkCode(data)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not create your link code.') }
    finally { setLinkBusy(false) }
  }

  return (
    <div className="dash-main">
      <h1>Profile</h1>
      {error && <div className="banner banner-error">{error}</div>}

      <div className="list-panel">
        <div className="list-row"><div className="list-row-title">Name</div><div className="list-row-meta">{profile.full_name}</div></div>
        <div className="list-row"><div className="list-row-title">Email</div><div className="list-row-meta">{profile.email}</div></div>
        <div className="list-row"><div className="list-row-title">Role</div><div className="list-row-meta">{profile.role}</div></div>
        <div className="list-row"><div className="list-row-title">Coins</div><div className="list-row-meta">{profile.coin_balance}</div></div>
      </div>

      <div className="section-heading"><h2>Language</h2></div>
      <div className="field">
        <select value={profile.preferred_language} onChange={(e) => changeLanguage(e.target.value)} disabled={saving}>
          {languages.map((l) => (
            <option key={l.language_code} value={l.language_name}>{l.native_name}</option>
          ))}
        </select>
      </div>

      {profile.role === 'student' && <section>
        <div className="section-heading"><h2>Connect a parent or guardian</h2></div>
        <p className="muted">Share this code only with your parent or guardian. It expires after 30 minutes. Generating a new code replaces the previous one.</p>
        <button className="btn btn-primary" disabled={linkBusy} onClick={createParentLink}>{linkBusy ? 'Generating…' : 'Generate parent link code'}</button>
        {linkCode && <div className="field"><label htmlFor="parent-link-code">Parent link code</label><input id="parent-link-code" readOnly value={linkCode} onFocus={e => e.target.select()} /></div>}
      </section>}

      <button className="btn btn-secondary btn-block" onClick={() => logoutUser()}>Log out</button>
    </div>
  )
}
