import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'

type Preferences = { largeText: boolean; reducedMotion: boolean }
const key = 'mela_device_preferences_v1'
function read(): Preferences {
  try { const value = JSON.parse(localStorage.getItem(key) || '{}'); return {largeText: value.largeText === true, reducedMotion: value.reducedMotion === true} }
  catch { return {largeText: false, reducedMotion: false} }
}
export default function DeviceSettings() {
  const {language, setLanguage} = useI18n()
  const [preferences, setPreferences] = useState(read)
  const [notice, setNotice] = useState('')
  useEffect(() => {
    document.documentElement.classList.toggle('mela-large-text', preferences.largeText)
    document.documentElement.classList.toggle('mela-reduced-motion', preferences.reducedMotion)
  }, [preferences])
  function save(next: Preferences) {
    setPreferences(next)
    try { localStorage.setItem(key, JSON.stringify(next)); setNotice('Display settings saved on this device.') }
    catch { setNotice('Applied for this session. This browser could not save the settings.') }
  }
  return <details className="device-settings">
    <summary>Settings & downloads</summary>
    <div className="list-panel">
      <h2>Display and language</h2>
      <p>These preferences apply on this device. Your signed-in profile has its own saved account language.</p>
      <label>Interface language <select value={language} onChange={e => setLanguage(e.target.value)}>
        <option value="en">English</option><option value="am">አማርኛ</option><option value="om">Afaan Oromoo</option><option value="ti">ትግርኛ</option><option value="so">Soomaali</option>
      </select></label>
      <label><input type="checkbox" checked={preferences.largeText} onChange={e => save({...preferences, largeText: e.target.checked})} /> Larger text</label>
      <label><input type="checkbox" checked={preferences.reducedMotion} onChange={e => save({...preferences, reducedMotion: e.target.checked})} /> Reduce animation</label>
      <button className="btn btn-secondary" onClick={() => save({largeText:false,reducedMotion:false})}>Reset display settings</button>
      {notice && <p role="status">{notice}</p>}
      <h2>Lessons and downloads</h2>
      <p>The AI Year One handbook contains 52 weekly draft lessons. It needs teacher approval and does not award completion or certificates.</p>
      <a className="btn btn-primary" href={`${import.meta.env.BASE_URL}ai-year-one.html`}>Read AI Year One</a>{' '}
      <a className="btn btn-secondary" href={`${import.meta.env.BASE_URL}ai-year-one.html`} download="MELA-AI-Year-One.html">Download lesson handbook</a>
      <h2>Account and security</h2>
      <p>Use Profile for account information. Password recovery is available from Log in → Forgot password. Roles, teacher verification and subject permissions require an authorized administrator; they cannot be changed here.</p>
      <h2>Teacher question review</h2>
      <p>Sign in with a teacher account and open Educator content review → Question reviews. An administrator must first check the teacher’s qualifications, institution, subjects and grades in Central Admin → Moderation → Teacher reviewer verification.</p>
      <p>Notifications, payments and privacy permissions are not controlled by these display settings.</p>
    </div>
  </details>
}
