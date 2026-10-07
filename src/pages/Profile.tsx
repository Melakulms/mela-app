import JoinClassroom from '../components/JoinClassroom'
import { supabase } from '../lib/supabase'
import { useEffect, useState } from 'react'
import { fetchEnabledLanguages, type PlatformLanguage } from '../lib/languages'
import { updatePreferredLanguage, logoutUser, type MelaProfile } from '../lib/auth'
import { useI18n } from '../i18n'

export default function Profile({ profile, onProfileUpdated }: { profile: MelaProfile; onProfileUpdated: () => void }) {
  const { t } = useI18n()
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
      setError(e.message ?? t('languageSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const createParentLink = async () => {
    setLinkBusy(true); setError('')
    try {
      const { data, error } = await supabase.rpc('create_parent_link_invite_v35')
      if (error) throw error
      if (typeof data !== 'string' || !data) throw new Error(t('connectionError'))
      setLinkCode(data)
    } catch (error) { setError(error instanceof Error ? error.message : t('connectionError')) }
    finally { setLinkBusy(false) }
  }

  return (
    <div className="dash-main">
      <h1>{t('profileHeading')}</h1>
      {error && <div className="banner banner-error">{error}</div>}

      <div className="section-heading"><h2>{t('personalInformation')}</h2></div>
      <div className="list-panel">
        <div className="list-row"><div className="list-row-title">{t('name')}</div><div className="list-row-meta">{profile.full_name}</div></div>
        <div className="list-row"><div className="list-row-title">{t('email')}</div><div className="list-row-meta">{profile.email}</div></div>
        <div className="list-row"><div className="list-row-title">{t('role')}</div><div className="list-row-meta">{profile.role}</div></div>
        <div className="list-row"><div className="list-row-title">{t('coins')}</div><div className="list-row-meta">{profile.coin_balance}</div></div>
      </div>

      <div className="section-heading"><h2>{t('language')}</h2></div>
      <div className="field">
        <select value={profile.preferred_language} onChange={(e) => changeLanguage(e.target.value)} disabled={saving}>
          {languages.map((l) => (
            <option key={l.language_code} value={l.language_name}>{l.native_name}</option>
          ))}
        </select>
      </div>

      {profile.role === 'student' && <JoinClassroom />}
      {profile.role === 'student' && <section>
        <div className="section-heading"><h2>{t('connectParent')}</h2></div>
        <p className="muted">{t('parentLinkHelp')}</p>
        <button className="btn btn-primary" disabled={linkBusy} onClick={createParentLink}>{linkBusy ? t('generating') : t('generateParentLink')}</button>
        {linkCode && <div className="field"><label htmlFor="parent-link-code">{t('parentLinkCode')}</label><input id="parent-link-code" readOnly value={linkCode} onFocus={e => e.target.select()} /></div>}
      </section>}

      <button className="btn btn-secondary btn-block" onClick={() => logoutUser()}>{t('logout')}</button>
    </div>
  )
}
