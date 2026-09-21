import { useEffect, useState } from 'react'
import { fetchEnabledLanguages, type PlatformLanguage } from '../lib/languages'
import { updatePreferredLanguage, logoutUser, type MelaProfile } from '../lib/auth'

export default function Profile({ profile, onProfileUpdated }: { profile: MelaProfile; onProfileUpdated: () => void }) {
  const [languages, setLanguages] = useState<PlatformLanguage[]>([])
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

      <button className="btn btn-secondary btn-block" onClick={() => logoutUser()}>Log out</button>
    </div>
  )
}
