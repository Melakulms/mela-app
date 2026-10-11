import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, ShieldCheck, Palette, Bell, BookOpen, Languages, Download, Lock, HeartHandshake } from 'lucide-react'
import type { MelaProfile } from '../lib/auth'
import { requestPasswordReset, updatePreferredLanguage } from '../lib/auth'
import { fetchEnabledLanguages, type PlatformLanguage } from '../lib/languages'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_USER_SETTINGS,
  fetchUserSettings,
  loadDeviceAppearance,
  saveDeviceAppearance,
  updateUserSettings,
  type UserSettings,
} from '../lib/user-settings'

type Props = {
  profile: MelaProfile
  onProfileUpdated: () => void
  onBack: () => void
  onSafety?: () => void
}

export default function SettingsPage({ profile, onProfileUpdated, onBack, onSafety }: Props) {
  const [settings, setSettings] = useState<UserSettings>(() => ({
    ...DEFAULT_USER_SETTINGS,
    ...loadDeviceAppearance(),
  }))
  const [languages, setLanguages] = useState<PlatformLanguage[]>([])
  const [loading, setLoading] = useState(true)
  const [backendAvailable, setBackendAvailable] = useState(false)
  const [saving, setSaving] = useState(false)
  const [languageBusy, setLanguageBusy] = useState(false)
  const [securityBusy, setSecurityBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    setBackendAvailable(false)
    fetchUserSettings().then(data => {
      if (!active) return
      setSettings(data)
      saveDeviceAppearance(data)
      setBackendAvailable(true)
    }).catch(() => {
      if (active) setError('Account preferences are not connected to the database yet. Display changes still work on this device.')
    }).finally(() => { if (active) setLoading(false) })
    fetchEnabledLanguages().then(value => { if (active) setLanguages(value) }).catch(() => {})
    return () => { active = false }
  }, [profile.id])

  function edit<K extends keyof UserSettings>(name: K, value: UserSettings[K]) {
    const next = { ...settings, [name]: value }
    setSettings(next)
    setNotice('')
    if (name === 'theme' || name === 'large_text' || name === 'reduced_motion' || name === 'high_contrast') {
      saveDeviceAppearance(next)
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!backendAvailable) { setError('Account preferences cannot be saved until the database migration is applied.'); return }
    setSaving(true); setError(''); setNotice('')
    try {
      await updateUserSettings(settings)
      setNotice('Your settings were saved to your MELA account.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Settings could not be saved.')
    } finally { setSaving(false) }
  }

  async function changeLanguage(value: string) {
    setLanguageBusy(true); setError(''); setNotice('')
    try {
      await updatePreferredLanguage(value)
      onProfileUpdated()
      setNotice('Your account language was updated.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Language could not be saved.')
    } finally { setLanguageBusy(false) }
  }

  async function sendPasswordReset() {
    if (!profile.email || profile.email.endsWith('.invalid')) {
      setError('This account cannot use email password recovery. Use the account recovery option on the sign-in screen.')
      return
    }
    setSecurityBusy(true); setError(''); setNotice('')
    try {
      const { error: resetError } = await requestPasswordReset(profile.email)
      if (resetError) throw resetError
      setNotice('If this email is eligible, password recovery instructions have been sent.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Password recovery is unavailable.')
    } finally { setSecurityBusy(false) }
  }

  return <div className="dash-main mela-settings-page">
    <div className="settings-heading">
      <div><span className="eyebrow">ACCOUNT CONTROL</span><h1><SettingsIcon size={26} aria-hidden="true" /> Settings</h1></div>
      <button type="button" className="btn btn-secondary" onClick={onBack}>Back</button>
    </div>
    <p>Choose what works for your account and device. Security and permissions are controlled separately by the platform.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {notice && <div className="banner banner-info" role="status">{notice}</div>}
    {loading && <p role="status">Loading account settings…</p>}

    <section className="settings-panel">
      <h2><ShieldCheck size={20}/> Account & security</h2>
      <div className="settings-summary">
        <div><strong>Name</strong><span>{profile.full_name || 'Not supplied'}</span></div>
        <div><strong>Role</strong><span>{profile.role}</span></div>
        <div><strong>Account</strong><span>{profile.email || profile.username || '—'}</span></div>
      </div>
      <div className="settings-actions">
        <button className="btn btn-secondary" type="button" onClick={() => void sendPasswordReset()} disabled={securityBusy}>Request password reset</button>
        <button className="btn btn-secondary" type="button" onClick={() => void supabase.auth.signOut({ scope: 'global' })}>Sign out all sessions</button>
      </div>
      <p className="settings-note">Signing out globally revokes refresh tokens. Already issued access tokens may remain valid until their expiry. Multi-factor enrollment and account deletion need separate verified flows.</p>
    </section>

    <section className="settings-panel">
      <h2><Languages size={20}/> Language</h2>
      <label className="settings-field">Account language
        <select value={profile.preferred_language} disabled={languageBusy || languages.length === 0} onChange={e => void changeLanguage(e.target.value)}>
          {!languages.some(l => l.language_name === profile.preferred_language) && <option value={profile.preferred_language}>{profile.preferred_language}</option>}
          {languages.map(l => <option value={l.language_name} key={l.language_code}>{l.native_name}</option>)}
        </select>
      </label>
      <p className="settings-note">Language is saved to your profile. Content that has not yet been translated may still display in English.</p>
    </section>

    <form onSubmit={event => void save(event)}>
      <section className="settings-panel">
        <h2><Palette size={20}/> Appearance & accessibility</h2>
        <label className="settings-field">Color theme
          <select value={settings.theme} onChange={e => edit('theme', e.target.value as UserSettings['theme'])}>
            <option value="system">Follow device</option><option value="dark">Dark</option><option value="light">Light</option>
          </select>
        </label>
        <label className="settings-checkbox"><input type="checkbox" checked={settings.large_text} onChange={e => edit('large_text', e.target.checked)} /> Larger text</label>
        <label className="settings-checkbox"><input type="checkbox" checked={settings.high_contrast} onChange={e => edit('high_contrast', e.target.checked)} /> High contrast</label>
        <label className="settings-checkbox"><input type="checkbox" checked={settings.reduced_motion} onChange={e => edit('reduced_motion', e.target.checked)} /> Reduce animations</label>
        <p className="settings-note">Display changes apply immediately to this device, even if account sync is unavailable.</p>
      </section>

      <section className="settings-panel">
        <h2><Bell size={20}/> Notification preferences</h2>
        {([
          ['notify_courses', 'Courses and lesson reminders'],
          ['notify_competitions', 'Arena competitions and results'],
          ['notify_opportunities', 'Scholarships and work opportunities'],
          ['notify_messages', 'Mentor and teacher messages'],
          ['study_reminders', 'Daily study reminders'],
        ] as const).map(([field, label]) =>
          <label className="settings-checkbox" key={field}>
            <input type="checkbox" checked={settings[field]} onChange={e => edit(field, e.target.checked)} />
            {label}
          </label>
        )}
        <p className="settings-note">These preferences are stored, but automatic notification delivery must be integrated with them before they can be relied on for opt-outs. Essential security notices are unaffected.</p>
      </section>

      <section className="settings-panel">
        <h2><BookOpen size={20}/> Learning preferences</h2>
        <label className="settings-field">Daily study target (minutes)
          <input type="number" min={5} max={240} step={5} value={settings.daily_study_minutes} onChange={e => edit('daily_study_minutes', Number(e.target.value))} required />
        </label>
        <p className="settings-note">Your target is personal. Course completions and teacher-approved assessments are tracked separately.</p>
      </section>
      <button type="submit" className="btn btn-primary btn-block" disabled={saving || loading || !backendAvailable}>
        {saving ? 'Saving account settings…' : 'Save account settings'}
      </button>
    </form>

    <section className="settings-panel">
      <h2><Lock size={20}/> Privacy & safeguarding</h2>
      <p>Private student information, parent consent, educational records, and account access are protected by platform permissions. Changing a visual setting cannot override these safeguards.</p>
      {profile.role === 'student' && onSafety && <button type="button" className="btn btn-secondary" onClick={onSafety}>Open Safety & Privacy Center</button>}
      <p className="settings-note">Account data exports, deletion requests, and guardian authorizations require verified service workflows and cannot be granted from this screen.</p>
    </section>

    <section className="settings-panel">
      <h2><Download size={20}/> App and downloads</h2>
      <a className="btn btn-secondary" href={`${import.meta.env.BASE_URL}ai-year-one.html`} download="MELA-AI-Year-One.html">Download draft AI Year One handbook</a>
      <p className="settings-note">The handbook is draft educational material, not a certified or completed course. Use the Install MELA banner for app installation where your browser supports it.</p>
      <button className="btn btn-secondary" type="button" onClick={() => window.location.reload()}>Check for app update</button>
    </section>

    <section className="settings-panel">
      <h2><HeartHandshake size={20}/> Your role</h2>
      <p>{profile.role === 'student'
        ? 'Use Career Passport, Arena, Study Materials and your linked guardian settings from the learning dashboard.'
        : profile.role === 'teacher'
          ? 'Open the Teacher Dashboard for classroom and subject-specific question review. Qualification approval remains with Central Admin.'
          : profile.role === 'parent'
            ? 'Use the Parent Dashboard to manage verified learner connections and view permitted progress.'
            : profile.role === 'mentor'
              ? 'Manage requests and mentoring availability through the Mentor Dashboard.'
              : profile.role === 'employer' || profile.role === 'company'
                ? 'Employer verification and job listings are controlled through the Employer Portal.'
                : 'Administrators should use the MFA-protected Central Admin for platform controls.'}</p>
    </section>
  </div>
}
