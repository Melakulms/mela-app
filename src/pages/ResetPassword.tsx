import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword({ sessionReady, onComplete }: { sessionReady: boolean; onComplete: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError('Use at least 12 characters, including uppercase, lowercase, and a number.')
      return
    }
    if (password !== confirmation) { setError('Passwords do not match.'); return }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPassword('')
      setConfirmation('')
      setSaved(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update your password. Please try again.')
    } finally { setBusy(false) }
  }

  return <div className="auth-shell"><div className="auth-card">
    <span className="auth-wordmark">MELA</span><h1>Reset your password</h1>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {saved ? <><p role="status">Your password has been updated.</p><button className="btn btn-primary btn-block" onClick={onComplete}>Continue to MELA</button></>
      : !sessionReady ? <><p>This reset link is invalid or expired. Return to login and request a new link.</p><button className="btn btn-secondary" onClick={onComplete}>Return to login</button></>
      : <form onSubmit={submit}>
        <div className="field"><label htmlFor="new-password">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
        <p className="field-hint">At least 12 characters, including uppercase, lowercase, and a number.</p>
        <div className="field"><label htmlFor="confirm-new-password">Confirm password</label><input id="confirm-new-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Saving…' : 'Save password'}</button>
      </form>}
  </div></div>
}
