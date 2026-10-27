import { useState } from 'react'

type ReleaseCheck = 'idle' | 'checking' | 'current' | 'outdated' | 'offline' | 'unavailable'

/** Only compares public build hashes. No authentication, learner records or cached
 * study progress are read, stored, cleared or sent by this component.
 */
export default function PassportReleaseStatus() {
  const runningCommit = String(import.meta.env.VITE_MELA_BUILD_SHA ?? '').trim().toLowerCase()
  const validCommit = /^[a-f0-9]{40}$/
  const [check, setCheck] = useState<ReleaseCheck>('idle')
  const [latestCommit, setLatestCommit] = useState('')
  const checkLatest = async () => {
    if (check === 'checking') return
    if (!navigator.onLine) {
      setCheck('offline')
      return
    }
    setCheck('checking')
    try {
      const url = new URL('mela-release.json', document.baseURI)
      url.searchParams.set('check', String(Date.now()))
      const response = await fetch(url.toString(), { cache: 'no-store' })
      if (!response.ok) throw new Error('Release marker unavailable')
      const marker: unknown = await response.json()
      const published = marker && typeof marker === 'object' && 'commit' in marker
        ? (marker as {commit?: unknown}).commit : null
      if (typeof published !== 'string' || !validCommit.test(published)) throw new Error('Invalid release marker')
      setLatestCommit(published)
      setCheck(validCommit.test(runningCommit) && runningCommit === published ? 'current' : 'outdated')
    } catch {
      setCheck('unavailable')
    }
  }
  const reloadLatest = () => {
    if (!navigator.onLine) {
      setCheck('offline')
      return
    }
    if (!window.confirm('Save any unfinished Career Passport form first. Reload MELA from the internet now?')) return
    const url = new URL(window.location.href)
    url.searchParams.set('mela_refresh', String(Date.now()))
    url.hash = ''
    window.location.assign(url.toString())
  }
  return <section className="list-panel question-card" aria-label="Career Passport release and verification protection">
    <h2>Career Passport · Production protection update</h2>
    <p>Verification safety is now active: education and experience records cannot be edited or deleted while a review is pending. Verified records cannot be deleted by learners. Rejected records can be corrected after the decision.</p>
    <p className="field-hint">These are security improvements, not a separate new section. To see the lock in action, save a record and submit a verification request. Your record stays private and unverified until MELA review.</p>
    <p><strong>Version running on this phone:</strong> <code>{validCommit.test(runningCommit) ? runningCommit.slice(0, 8) : 'Preview / version unavailable'}</code></p>
    <div className="passport-quick-actions">
      <button className="btn btn-secondary" type="button" disabled={check === 'checking'} onClick={() => void checkLatest()}>{check === 'checking' ? 'Checking MELA version…' : 'Check latest MELA version'}</button>
      <button className="btn btn-secondary" type="button" onClick={reloadLatest}>Reload latest MELA</button>
    </div>
    {check === 'current' && <p role="status">This phone is running the latest published MELA version.</p>}
    {check === 'outdated' && <p role="status">A newer version <code>{latestCommit.slice(0, 8)}</code> is published. Save your work and choose Reload latest MELA.</p>}
    {check === 'offline' && <p role="status">Connect to the internet to check or reload your MELA version.</p>}
    {check === 'unavailable' && <p role="status">The latest version could not be checked. Your current records are unchanged. Please retry when connected.</p>}
  </section>
}
