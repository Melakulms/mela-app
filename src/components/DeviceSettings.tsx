import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import {
  applyAppearance,
  loadDeviceAppearance,
  saveDeviceAppearance,
  type ThemeMode,
} from '../lib/device-appearance'

type Preferences = { largeText: boolean; reducedMotion: boolean; highContrast: boolean; theme: ThemeMode }
function read(): Preferences {
  const saved = loadDeviceAppearance()
  return { largeText: saved.large_text, reducedMotion: saved.reduced_motion, highContrast: saved.high_contrast, theme: saved.theme }
}

export default function DeviceSettings() {
  const { language, setLanguage } = useI18n()
  const [preferences, setPreferences] = useState(read)
  const [notice, setNotice] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateNotice, setUpdateNotice] = useState('')

  async function refreshInstalledApp() {
    if (checkingUpdate) return
    if (!navigator.onLine) {
      setUpdateNotice('Connect to the internet before updating MELA. Your saved data was not changed.')
      return
    }
    setCheckingUpdate(true); setUpdateNotice('Checking the published app…')
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration(new URL('.', document.baseURI).pathname)
        if (registration) await registration.update()
      }
      // The shell is network-first and versioned JS files have distinct names.
      // A deliberate refresh will fetch the latest deployed release without deleting account data.
      window.location.reload()
    } catch {
      setUpdateNotice('Could not check for the latest version. Your current app is unchanged. Try again while online.')
      setCheckingUpdate(false)
    }
  }
  useEffect(() => {
    const sync = () => setPreferences(read())
    window.addEventListener('mela-settings-changed', sync)
    return () => window.removeEventListener('mela-settings-changed', sync)
  }, [])
  useEffect(() => {
    applyAppearance({
      theme: preferences.theme,
      large_text: preferences.largeText,
      reduced_motion: preferences.reducedMotion,
      high_contrast: preferences.highContrast,
    })
  }, [preferences])
  function save(next: Preferences) {
    setPreferences(next)
    saveDeviceAppearance({
      theme: next.theme,
      large_text: next.largeText,
      reduced_motion: next.reducedMotion,
      high_contrast: next.highContrast,
    })
    setNotice('Display settings applied on this device.')
  }
  return <details className="device-settings">
    <summary>Settings & downloads</summary>
    <div className="list-panel">
      <h2>Display and language</h2>
      <p>These display preferences apply on this device. Signed-in users can save account settings in the Settings page. Your account language is managed separately.</p>
      <label>Interface language <select value={language} onChange={e => setLanguage(e.target.value)}>
        <option value="en">English</option><option value="am">አማርኛ</option><option value="om">Afaan Oromoo</option><option value="ti">ትግርኛ</option><option value="so">Soomaali</option>
      </select></label>
      <label>Theme <select aria-label="Theme" value={preferences.theme} onChange={e => save({ ...preferences, theme: e.target.value as ThemeMode })}>
        <option value="system">Follow device</option><option value="dark">Dark</option><option value="light">Light</option>
      </select></label>
      <label><input type="checkbox" checked={preferences.largeText} onChange={e => save({ ...preferences, largeText: e.target.checked })} /> Larger text</label>
      <label><input type="checkbox" checked={preferences.highContrast} onChange={e => save({ ...preferences, highContrast: e.target.checked })} /> High contrast</label>
      <label><input type="checkbox" checked={preferences.reducedMotion} onChange={e => save({ ...preferences, reducedMotion: e.target.checked })} /> Reduce animation</label>
      <button className="btn btn-secondary" onClick={() => save({ largeText: false, reducedMotion: false, highContrast: false, theme: 'system' })}>Reset display settings</button>
      {notice && <p role="status">{notice}</p>}
      <h2>Installed app updates</h2>
      <p>MELA is an installable website, not an APK. New features appear in this installed app after they are published. Save any work before refreshing.</p>
      <button type="button" className="btn btn-primary" onClick={() => void refreshInstalledApp()} disabled={checkingUpdate}>
        {checkingUpdate ? 'Checking published version…' : 'Check and refresh installed MELA'}
      </button>
      {updateNotice && <p role="status">{updateNotice}</p>}
      <p className="field-hint">Refreshing does not install unreleased development features. Your account and saved review decisions remain on the server.</p>
      <h2>Lessons and downloads</h2>
      <p>The AI Year One handbook contains 52 weekly draft lessons. It needs teacher approval and does not award completion or certificates.</p>
      <a className="btn btn-primary" href={`${import.meta.env.BASE_URL}ai-year-one.html`}>Read AI Year One</a>{' '}
      <a className="btn btn-secondary" href={`${import.meta.env.BASE_URL}ai-year-one.html`} download="MELA-AI-Year-One.html">Download lesson handbook</a>
      <h2>Account and security</h2>
      <p>Signed-in users can open Settings from the top bar to manage account preferences and security. Roles and teacher verification remain administrator-controlled.</p>
      <h2>Teacher question review</h2>
      <p>Sign in with a teacher account and open Educator content review → Question reviews. An administrator must first verify qualifications and subject permissions in Central Admin.</p>
    </div>
  </details>
}
