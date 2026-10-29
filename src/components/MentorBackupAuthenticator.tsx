import { useEffect, useState } from 'react'
import {
  getMentorMfaSnapshot, mapMfaError, startTotpEnrollment, verifyTotp,
  type TotpEnrollment,
} from '../lib/mentor-mfa'
import MentorMfaGate from './MentorMfaGate'

/** Backup factors are enrolled only from an already AAL2-authenticated session. */
export default function MentorBackupAuthenticator() {
  const [ready, setReady] = useState(false)
  const [factorCount, setFactorCount] = useState<number | null>(null)
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showGate, setShowGate] = useState(false)

  const check = async () => {
    const snapshot = await getMentorMfaSnapshot()
    setReady(snapshot.currentLevel === 'aal2' && snapshot.verifiedFactorCount > 0)
    setFactorCount(snapshot.verifiedFactorCount)
  }
  useEffect(() => {
    let active = true
    void getMentorMfaSnapshot().then(s => {
      if (!active) return
      setReady(s.currentLevel === 'aal2' && s.verifiedFactorCount > 0)
      setFactorCount(s.verifiedFactorCount)
    }).catch(() => { if (active) setError('Could not check your authenticator configuration.') })
    const clear = () => { setReady(false); setFactorCount(null); setEnrollment(null); setCode(''); setShowGate(false) }
    window.addEventListener('mela:session-boundary', clear)
    return () => { active = false; window.removeEventListener('mela:session-boundary', clear) }
  }, [])

  const enroll = async () => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const factor = await startTotpEnrollment(true)
      setEnrollment(factor)
    } catch (e) { setError(mapMfaError(e)) }
    finally { setBusy(false) }
  }
  const verify = async () => {
    if (busy || !enrollment) return
    setBusy(true); setError('')
    try {
      await verifyTotp(enrollment.factorId, code)
      setEnrollment(null); setCode('')
      await check()
      setNotice('Backup authenticator verified. Store the backup on a separate device.')
    } catch (e) { setError(mapMfaError(e)) }
    finally { setBusy(false) }
  }

  return <section className="empty-panel" aria-label="Backup authenticator" style={{ textAlign: 'left' }}>
    <h3>Backup authenticator</h3>
    <p>Protect your mentoring notes against a lost phone. Add a second authenticator on a separate device while you still have your primary factor. MELA does not issue recovery codes.</p>
    {factorCount === null && !error && <p role="status">Checking two-step security…</p>}
    {factorCount !== null && <p role="status">Verified authenticators: {factorCount}</p>}
    {factorCount === 0 && <p>Enroll and verify your first authenticator through the secure notes gate before adding a backup.</p>}
    {factorCount !== null && factorCount > 0 && !ready && !showGate &&
      <button type="button" className="btn btn-secondary" onClick={() => setShowGate(true)}>
        Verify identity to manage backup
      </button>}
    {showGate && !ready && <MentorMfaGate purpose="add a backup authenticator"
      onReady={() => { setShowGate(false); void check() }}
      onCancel={() => setShowGate(false)} />}
    {ready && !enrollment && <button type="button" className="btn btn-secondary" disabled={busy || factorCount === 10}
      onClick={() => void enroll()}>{busy ? 'Preparing…' : 'Add a backup authenticator'}</button>}
    {ready && enrollment && <>
      <p>Scan this QR using your backup authenticator, or enter the key manually. Keep it separate from your first device.</p>
      <img src={enrollment.qrCode} alt="Backup authenticator QR setup" width={180} height={180} />
      <p>Setup key: <code style={{ overflowWrap: 'anywhere' }}>{enrollment.secret}</code></p>
      <label htmlFor="mentor-backup-code">Code from backup authenticator</label>
      <input id="mentor-backup-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        value={code} disabled={busy} onChange={e => setCode(e.target.value.replace(/\D/g,''))} />
      <button type="button" className="btn btn-primary" disabled={busy || code.length !== 6}
        onClick={() => void verify()}>{busy ? 'Verifying…' : 'Confirm backup'}</button>
      <button type="button" className="btn btn-secondary" disabled={busy}
        onClick={() => { setEnrollment(null); setCode('') }}>Not now</button>
    </>}
    {notice && <p className="banner banner-info" role="status">{notice}</p>}
    {error && <p className="banner banner-error" role="alert">{error}</p>}
  </section>
}
