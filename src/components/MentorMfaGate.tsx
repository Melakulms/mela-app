import { useEffect, useRef, useState } from 'react'
import {
  decideMfaGate, discardUnfinishedTotp, getMentorMfaSnapshot, mapMfaError,
  startTotpEnrollment, verifyExistingTotp, verifyTotp,
  type MfaGateState, type TotpEnrollment,
} from '../lib/mentor-mfa'

/** Usability gate only. Privileged RPCs still validate signed JWT and AAL2 server-side. */
export default function MentorMfaGate({ purpose, onReady, onCancel }: {
  purpose: string
  onReady: () => void
  onCancel: () => void
}) {
  const [state, setState] = useState<MfaGateState | 'loading' | 'unavailable'>('loading')
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const once = useRef(false)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const finish = () => {
    if (!once.current) { once.current = true; onReadyRef.current() }
  }
  useEffect(() => {
    let mounted = true
    getMentorMfaSnapshot().then(s => {
      if (!mounted) return
      const next = decideMfaGate(s)
      if (next === 'ready') {
        if (!once.current) { once.current = true; onReadyRef.current() }
      } else setState(next)
    }).catch(() => { if (mounted) setState('unavailable') })
    return () => { mounted = false }
  }, [])

  const execute = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError('')
    try { await fn(); finish() }
    catch (cause) { setError(mapMfaError(cause)) }
    finally { setBusy(false) }
  }

  const enroll = async (restart = false) => {
    if (busy) return
    setBusy(true); setError('')
    try {
      if (restart) await discardUnfinishedTotp()
      const factor = await startTotpEnrollment()
      setEnrollment(factor); setCode(''); setState('enroll')
    } catch (cause) { setError(mapMfaError(cause)) }
    finally { setBusy(false) }
  }

  if (state === 'loading') return <p role="status">Checking two-step verification…</p>
  if (state === 'unavailable') return <div className="banner banner-error" role="alert">
    Two-step verification could not be checked. {purpose} is paused.
    <button className="btn btn-secondary" onClick={onCancel}>Close</button>
  </div>

  return <div className="empty-panel" role="group" aria-label="Two-step verification" style={{ textAlign: 'left' }}>
    <h3>Two-step verification required</h3>
    <p>To {purpose}, verify with an authenticator app. You can cancel without losing saved notes.</p>
    {state === 'enroll' && !enrollment && <button className="btn btn-primary" disabled={busy} onClick={() => void enroll()}>
      Set up authenticator
    </button>}
    {state === 'resume_setup' && <button className="btn btn-primary" disabled={busy} onClick={() => void enroll(true)}>
      Restart unfinished setup
    </button>}
    {state === 'enroll' && enrollment && <>
      <p>Scan this QR code using your authenticator app, or enter the setup key manually.</p>
      <img src={enrollment.qrCode} alt="Authenticator setup QR code" width={180} height={180} />
      <p>Setup key: <code style={{ overflowWrap: 'anywhere' }}>{enrollment.secret}</code></p>
    </>}
    {(state === 'verify' || (state === 'enroll' && enrollment)) && <>
      <label htmlFor="mentor-two-step-code">6-digit authenticator code</label>
      <input id="mentor-two-step-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
        value={code} disabled={busy} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
      <button className="btn btn-primary" disabled={busy || code.length !== 6} onClick={() => void execute(() =>
        enrollment ? verifyTotp(enrollment.factorId, code) : verifyExistingTotp(code))}>
        {busy ? 'Verifying…' : 'Verify'}
      </button>
    </>}
    {state === 'verify' && <p className="muted">Lost your authenticator? Contact MELA support. Account recovery requires an independent identity review.</p>}
    {error && <p role="alert" className="banner banner-error">{error}</p>}
    <button className="btn btn-secondary" disabled={busy} onClick={onCancel}>Not now</button>
  </div>
}
