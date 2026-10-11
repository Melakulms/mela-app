import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n'
import {
  DEFAULT_DEVICE_PREFERENCES, readDevicePreferences, saveDevicePreferences,
  type DevicePreferences, type ThemeMode, type AccentColor, type ReadingSpacing,
} from '../lib/device-preferences'

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'am', name: 'አማርኛ' },
  { code: 'om', name: 'Afaan Oromoo' },
  { code: 'ti', name: 'ትግርኛ' },
  { code: 'so', name: 'Soomaali' },
]

export default function DeviceSettings() {
  const { language, setLanguage } = useI18n()
  const [preferences, setPreferences] = useState<DevicePreferences>(readDevicePreferences)
  const [notice, setNotice] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [releaseVersion, setReleaseVersion] = useState('')
  const [updateNotice, setUpdateNotice] = useState('')
  const [showResetConfirmation, setShowResetConfirmation] = useState(false)
  const wasOpen = useRef(false)
  const settingsHistoryEntry = useRef(false)

  const markSettingsOpen = () => {
    if (wasOpen.current) return
    wasOpen.current = true
    const previous = window.history.state
    const state = previous && typeof previous === 'object' ? previous : {}
    window.history.pushState({ ...state, melaSettingsOpen: true }, '', window.location.href)
    settingsHistoryEntry.current = true
  }

  const backHome = () => {
    wasOpen.current = false
    if (settingsHistoryEntry.current) {
      const previous = window.history.state
      const state = previous && typeof previous === 'object' ? previous : {}
      window.history.replaceState({ ...state, melaSettingsOpen: false }, '', window.location.href)
      settingsHistoryEntry.current = false
    }
    const panel = document.getElementById('mela-settings') as HTMLDetailsElement | null
    if (panel) panel.open = false
    setShowResetConfirmation(false)
    // Section links inside Settings update the hash. Remove only a Settings
    // hash so returning home does not jump back into a hidden panel.
    if (window.location.hash.startsWith('#settings-')) {
      window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    }
    // Home is a real destination, not only a React event. This also works
    // while the learner is still on the registration or profile setup screen.
    const home = new URL(window.location.href)
    home.searchParams.delete('mela_refresh')
    home.searchParams.set('view', 'dashboard')
    home.hash = ''
    window.history.replaceState(
      { ...(window.history.state && typeof window.history.state === 'object' ? window.history.state : {}), melaSettingsOpen: false },
      '',
      home,
    )
    window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }))
    window.dispatchEvent(new Event('mela:go-home'))
    window.scrollTo?.(0, 0)
    const focusHome = () => {
      const destination = document.querySelector<HTMLElement>('#main-content, .profile-access-hub, main.auth-layout, .auth-shell')
      destination?.scrollIntoView?.({ behavior: 'auto', block: 'start' })
      if (destination?.id === 'main-content') destination.focus({ preventScroll: true })
    }
    if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(focusHome)
    else focusHome()
  }

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && (document.getElementById('mela-settings') as HTMLDetailsElement | null)?.open) {
        event.preventDefault()
        backHome()
      }
    }
    const restoreOnBack = () => {
      // On Android the Back key pops the harmless Settings history entry.
      // Return to the dashboard without accidentally exiting MELA.
      const panel = document.getElementById('mela-settings') as HTMLDetailsElement | null
      if (panel?.open && !window.history.state?.melaSettingsOpen) backHome()
    }
    document.addEventListener('keydown', keydown)
    window.addEventListener('popstate', restoreOnBack)
    return () => {
      document.removeEventListener('keydown', keydown)
      window.removeEventListener('popstate', restoreOnBack)
    }
  })

  useEffect(() => {
    // Read the deployed build marker from the network, not a remembered UI label.
    // If it cannot be fetched, the app must not falsely claim it is updated.
    let active = true
    if (typeof fetch !== 'function') return () => { active = false }
    const marker = new URL('mela-release.json', document.baseURI)
    marker.searchParams.set('check', String(Date.now()))
    void fetch(marker.toString(), { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Release marker unavailable')
      const payload = await response.json() as { commit?: string }
      if (active && typeof payload.commit === 'string' && /^[a-f0-9]{40}$/.test(payload.commit)) {
        setReleaseVersion(payload.commit.slice(0, 8))
      }
    }).catch(() => { if (active) setReleaseVersion('') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    // Restore accessibility and theme each time the installed PWA opens.
    saveDevicePreferences(preferences)
    // Only at mount: never reset a changed choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const showSettings = () => {
      const panel = document.getElementById('mela-settings') as HTMLDetailsElement | null
      if (panel) {
        markSettingsOpen()
        panel.open = true
        panel.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
        panel.querySelector('summary')?.focus()
      }
    }
    window.addEventListener('mela:open-settings', showSettings)
    return () => window.removeEventListener('mela:open-settings', showSettings)
  }, [])

  function changeSettings(patch: Partial<DevicePreferences>) {
    const updated = { ...preferences, ...patch }
    setPreferences(updated)
    setShowResetConfirmation(false)
    setNotice(saveDevicePreferences(updated)
      ? 'Settings saved on this device and applied.'
      : 'Settings applied for this session; your browser could not save them.')
  }

  function resetSettings() {
    setShowResetConfirmation(false)
    const defaults = { ...DEFAULT_DEVICE_PREFERENCES }
    setPreferences(defaults)
    setNotice(saveDevicePreferences(defaults)
      ? 'Device preferences reset. Your account and learning records were not touched.'
      : 'Display reset for this session. Your account and learning records were not touched.')
  }

  async function refreshInstalledApp() {
    if (checkingUpdate) return
    if (!navigator.onLine) {
      setUpdateNotice('Connect to the internet before updating MELA. Your saved data was not changed.')
      return
    }
    setCheckingUpdate(true)
    setUpdateNotice('Checking the published app…')
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration(new URL('.', document.baseURI).pathname)
        if (registration) await registration.update()
      }
      // Keep account tokens and saved preferences. Only evict MELA's old
      // static shell caches; never clear storage or unrelated apps' caches.
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.filter(name => name.startsWith('mela-shell-')).map(name => caches.delete(name)))
      }
      const destination = new URL(window.location.href)
      destination.hash = ''
      destination.searchParams.set('mela_refresh', String(Date.now()))
      window.location.replace(destination.toString())
    } catch {
      setUpdateNotice('Could not check for the latest version. Your current app is unchanged. Try again while online.')
      setCheckingUpdate(false)
    }
  }

  return <details className="device-settings" id="mela-settings" onToggle={event => {
    if (event.currentTarget.open) markSettingsOpen()
    else if (wasOpen.current) backHome()
  }}>
    <summary tabIndex={0} onClick={event => {
      // The toggle event may fire asynchronously in Chromium. Claim the
      // history entry synchronously on touch/click before Android Back can run.
      if (!(event.currentTarget.parentElement as HTMLDetailsElement | null)?.open) markSettingsOpen()
    }}>Settings & downloads — app version</summary>
    <div className="settings-center">
      <div className="settings-center-heading">
        <div><span className="settings-kicker">MELA PERSONALIZATION</span><h1>Settings</h1><p>Make MELA comfortable to read and use. Changes below work immediately on this phone.</p></div>
        <button className="btn btn-primary" type="button" onClick={backHome}>Back to MELA Home</button>
      </div>
      {notice && <div className="banner banner-info" role="status">{notice}</div>}

      <nav className="settings-jump" aria-label="Settings sections">
        {([['settings-language','Language'],['settings-appearance','Appearance'],['settings-learning','Learning'],['settings-security','Security'],['settings-downloads','Downloads'],['settings-updates','Updates']] as const).map(([id,label]) =>
          <button type="button" key={id} className="btn btn-secondary" onClick={() => document.getElementById(id)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}>{label}</button>)}
      </nav>

      <section id="settings-language" className="settings-group" aria-labelledby="settings-language-heading">
        <h2 id="settings-language-heading">Language</h2>
        <label className="settings-control">Interface language
          <select value={language} onChange={e => {setLanguage(e.target.value);setNotice('Interface language changed on this device. Some content has not yet been translated.') }}>
            {LANGUAGES.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}
          </select>
        </label>
        <p className="settings-hint">Your selection is saved on this phone. The signed-in account's preferred language is managed separately in your profile; some course and question content still appears in English.</p>
      </section>

      <section id="settings-appearance" className="settings-group" aria-labelledby="settings-appearance-heading">
        <h2 id="settings-appearance-heading">Appearance & accessibility</h2>
        <label className="settings-control">Color theme
          <select aria-label="Color theme" value={preferences.theme} onChange={e => changeSettings({theme:e.target.value as ThemeMode})}>
            <option value="system">Follow device</option><option value="dark">Dark</option><option value="light">Light</option>
          </select>
        </label>
        <label className="settings-control">Accent color
          <select aria-label="Accent color" value={preferences.accent} onChange={e => changeSettings({accent:e.target.value as AccentColor})}>
            <option value="gold">MELA gold</option>
            <option value="teal">Ocean teal</option>
            <option value="violet">Lavender violet</option>
            <option value="coral">Sunset coral</option>
          </select>
        </label>
        <label className="settings-control">Reading spacing
          <select aria-label="Reading spacing" value={preferences.readingSpacing} onChange={e => changeSettings({readingSpacing:e.target.value as ReadingSpacing})}>
            <option value="standard">Standard</option>
            <option value="relaxed">Relaxed — easier reading</option>
            <option value="compact">Compact — more on screen</option>
          </select>
        </label>
        <p className="settings-hint">Accent and reading changes apply immediately to buttons, study text and supported screens.</p>
        <label className="settings-switch"><input type="checkbox" aria-label="Larger text" checked={preferences.largeText} onChange={e => changeSettings({largeText:e.target.checked})} /><span><strong>Larger text</strong><small>Increase the app's normal text size</small></span></label>
        <label className="settings-switch"><input type="checkbox" aria-label="High contrast" checked={preferences.highContrast} onChange={e => changeSettings({highContrast:e.target.checked})} /><span><strong>High contrast</strong><small>Stronger borders, labels and focus rings</small></span></label>
        <label className="settings-switch"><input type="checkbox" aria-label="Reduce animation" checked={preferences.reducedMotion} onChange={e => changeSettings({reducedMotion:e.target.checked})} /><span><strong>Reduce animation</strong><small>Limit animation and movement</small></span></label>
        <label className="settings-switch"><input type="checkbox" aria-label="Simpler visual effects" checked={preferences.lowData} onChange={e => changeSettings({lowData:e.target.checked})} /><span><strong>Simpler visual effects</strong><small>Reduce decorative gradients and animation; lessons still need internet access</small></span></label>
      </section>

      <section id="settings-learning" className="settings-group" aria-labelledby="settings-learning-heading">
        <h2 id="settings-learning-heading">Learning preferences</h2>
        <label className="settings-control">Daily study target (minutes on this device)
          <select value={preferences.dailyStudyMinutes} onChange={e => changeSettings({dailyStudyMinutes:Number(e.target.value)})}>
            {[5,10,15,20,30,45,60,90,120].map(minutes => <option value={minutes} key={minutes}>{minutes} minutes</option>)}
            {![5,10,15,20,30,45,60,90,120].includes(preferences.dailyStudyMinutes) && <option value={preferences.dailyStudyMinutes}>{preferences.dailyStudyMinutes} minutes</option>}
          </select>
        </label>
        <p className="settings-hint">Your goal is shown on the student dashboard. It is not a timer, automatic reminder, proof of study or teacher-certified progress.</p>
        <h3>Focus mode</h3>
        <label className="settings-switch"><input type="checkbox" aria-label="Focus mode" checked={preferences.focusMode} onChange={e => changeSettings({focusMode:e.target.checked})} />
          <span><strong>Focus on learning</strong><small>Show essential learning and safety tools first on the student dashboard, with a Show all tools option. No features or records are deleted.</small></span>
        </label>
        <p className="settings-hint">Focus mode changes the dashboard's visible suggestions only. It does not change your permissions or block direct access to other modules.</p>
        <h3>Notifications</h3>
        <p className="settings-hint">Email, SMS and push reminders are not yet connected to user preferences. They cannot be enabled or disabled from this device-settings screen. Essential account messages follow the existing account process.</p>
      </section>

      <section id="settings-security" className="settings-group" aria-labelledby="settings-security-heading">
        <h2 id="settings-security-heading">Account, security & privacy</h2>
        <p>Open <strong>Profile</strong> in the student's bottom navigation to edit account information. Use the <strong>Log out</strong> icon in the signed-in header to safely leave your account.</p>
        <p>For beta accounts, choose <strong>Forgot password</strong> on the login screen and use the saved recovery code. Don't share your password or recovery code.</p>
        <p>Teacher qualification approval, parent access, account deletion and personal-data exports require verified server-side processes. Changing these device controls cannot grant access or bypass them.</p>
        <div className="settings-confirm-area">
          {showResetConfirmation ? <>
            <p>Reset only this device's appearance, focus mode and study-target preferences? This will not remove your account, sign you out or delete learning data.</p>
            <button type="button" className="btn btn-secondary" onClick={() => setShowResetConfirmation(false)}>Cancel reset</button>{' '}
            <button type="button" className="btn btn-primary" onClick={resetSettings}>Confirm reset display settings</button>
          </> : <button type="button" className="btn btn-secondary" onClick={() => setShowResetConfirmation(true)}>Reset display settings</button>}
        </div>
      </section>

      <section id="settings-downloads" className="settings-group" aria-labelledby="settings-downloads-heading">
        <h2 id="settings-downloads-heading">AI lessons & downloads</h2>
        <p>The AI Year One handbook contains 52 weekly draft lessons. It still needs professional teacher review and does not award certificates or recorded completion.</p>
        <div className="settings-buttons">
          <a className="btn btn-primary" href={`${import.meta.env.BASE_URL}ai-year-one.html`}>Read AI Year One</a>
          <a className="btn btn-secondary" href={`${import.meta.env.BASE_URL}ai-year-one.html`} download="MELA-AI-Year-One.html">Download lesson handbook</a>
        </div>
        <p className="settings-hint">MELA is an installable website (PWA), not an APK. On Android Chrome, use the browser menu → Install app or Add to Home screen.</p>
      </section>

      <section id="settings-updates" className="settings-group" aria-labelledby="settings-updates-heading">
        <h2 id="settings-updates-heading">Installed app updates</h2>
        <p><strong>MELA release</strong> · {releaseVersion ? `Verified online build ${releaseVersion}` : 'Release not verified on this device'}</p>
        <p className="settings-hint">If the release is not verified or the new account selector is missing, your installed app may still be running an older publication.</p>
        <p>Save unfinished answers before refreshing. Reloading checks the currently published website; it does not install unreleased development features.</p>
        <button type="button" className="btn btn-primary" onClick={() => void refreshInstalledApp()} disabled={checkingUpdate}>
          {checkingUpdate ? 'Checking published version…' : 'Check and refresh installed MELA'}
        </button>
        {updateNotice && <p role="status">{updateNotice}</p>}
        <details className="settings-release-details">
          <summary>Registration, teacher review & pending platform features</summary>
          <p>Registration is the first screen for signed-out users, with a valid beta invitation code. MELA opens your existing account rather than showing registration again when signed in.</p>
          <p><strong>Not published in this release:</strong> account-synced notification settings, fully personalized scholarship matching, and public access to questions before teacher approval. Question review batches are prepared, but only verified teachers may submit decisions; this does not mean the questions are approved.</p>
          <p>Verified teachers can currently access Educator content review → Question reviews from the teacher dashboard where their permissions allow. Central Admin is responsible for teacher credential verification.</p>
        </details>
      </section>
      <button type="button" className="btn btn-primary btn-block" onClick={backHome}>Back to MELA Home</button>
    </div>
  </details>
}
