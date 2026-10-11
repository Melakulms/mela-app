import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MfaChallenge({ onVerified, onSignOut }: { onVerified: () => void; onSignOut: () => void }) {
  const [factorId, setFactorId] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    supabase.auth.mfa.listFactors().then(({ data, error: listError }) => {
      if (!active) return
      if (listError) { setError(listError.message); return }
      const verified = data?.totp.find(factor => factor.status === 'verified')
      if (!verified) { setError('No verified authenticator was found. Contact account support.'); return }
      setFactorId(verified.id)
    }).catch(() => { if (active) setError('Cannot verify authenticator setup. Try signing in again.') })
    return () => { active = false }
  }, [])

  const verify = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!factorId || !/^\d{6}$/.test(code) || busy) return
    setBusy(true); setError('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId, challengeId: challenge.id, code,
      })
      if (verifyError) throw verifyError
      setCode('')
      onVerified()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authenticator verification failed.')
    } finally { setBusy(false) }
  }

  return <div className="auth-shell"><section className="auth-card settings-mfa-challenge">
    <h1>Verify your authenticator</h1>
    <p>Enter the current six-digit code from your authenticator app to continue to MELA.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    <form onSubmit={event => void verify(event)}>
      <label className="settings-field">Six-digit authentication code
        <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required />
      </label>
      <button className="btn btn-primary btn-block" type="submit" disabled={busy || !factorId || code.length !== 6}>
        {busy ? 'Verifying…' : 'Verify and continue'}
      </button>
    </form>
    <button className="btn btn-secondary btn-block" type="button" onClick={onSignOut} disabled={busy}>Sign out</button>
    <p className="settings-note">If you lost your authenticator, use your account's verified recovery process. Password login does not bypass an enrolled second factor.</p>
  </section></div>
}
