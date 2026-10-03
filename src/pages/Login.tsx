import AuthLayout from '../components/AuthLayout'
import { useState } from 'react'
import { loginUser, requestPasswordReset, resetBetaPassword } from '../lib/auth'

export default function Login({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [betaRecovery, setBetaRecovery] = useState(false)
  const [recoveryCode, setRecoveryCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [nextRecoveryCode, setNextRecoveryCode] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error: loginError } = await loginUser(identifier, password)
      if (loginError) setError(loginError.message)
    } catch { setError('Could not connect. Check your connection and try again.') }
    finally { setBusy(false) }
  }

  const forgotPassword = async () => {
    const value = identifier.trim()
    if (!value) { setError('Enter your email or beta username above first, then tap "Forgot password".'); return }
    setError(''); setResetSent(false)
    if (!value.includes('@')) {
      setBetaRecovery(true)
      setRecoveryCode('')
      setNewPassword('')
      setConfirmNewPassword('')
      setNextRecoveryCode('')
      return
    }
    setBusy(true)
    try {
      const { error: resetError } = await requestPasswordReset(value)
      if (resetError) setError(resetError.message)
      else setResetSent(true)
    } catch { setError('Could not send the reset email. Please try again.') }
    finally { setBusy(false) }
  }

  const submitBetaRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 12 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('New password must be at least 12 characters and include uppercase, lowercase, and a number.')
      return
    }
    if (newPassword !== confirmNewPassword) { setError('New passwords do not match.'); return }
    setBusy(true)
    try {
      const result = await resetBetaPassword(identifier, recoveryCode, newPassword)
      setNextRecoveryCode(result.recovery_code)
      setRecoveryCode('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the beta password.')
    } finally { setBusy(false) }
  }

  if (betaRecovery) {
    return (
      <AuthLayout>
        <span className="auth-wordmark">MELA</span>
        <h1>Recover beta access</h1>
        <p className="auth-subtitle">Reset the password for <strong>{identifier.trim().toLowerCase()}</strong> using the recovery code saved when the account was created.</p>
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        {nextRecoveryCode ? (
          <>
            <div className="banner banner-info" role="status"><strong>Password changed.</strong> Your previous recovery code is no longer valid. Save the new code below.</div>
            <div className="field"><label htmlFor="nextRecoveryCode">New recovery code</label><input id="nextRecoveryCode" readOnly value={nextRecoveryCode} onFocus={(e) => e.currentTarget.select()} /></div>
            <button type="button" className="btn btn-secondary btn-block" onClick={() => navigator.clipboard.writeText(nextRecoveryCode).catch(() => {})}>Copy new recovery code</button>
            <button type="button" className="btn btn-primary btn-block" onClick={() => { setBetaRecovery(false); setNextRecoveryCode('') }}>Return to log in</button>
          </>
        ) : (
          <form onSubmit={submitBetaRecovery}>
            <div className="field"><label htmlFor="recoveryCode">Recovery code</label><input id="recoveryCode" required autoComplete="off" spellCheck={false} value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} disabled={busy} /></div>
            <div className="field"><label htmlFor="newPassword">New password</label><input id="newPassword" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={busy} /></div>
            <div className="field"><label htmlFor="confirmNewPassword">Confirm new password</label><input id="confirmNewPassword" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={busy} /></div>
            <button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide passwords' : 'Show passwords'}</button>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Resetting password…' : 'Reset beta password'}</button>
          </form>
        )}
        {!nextRecoveryCode && <div className="auth-switch"><button type="button" onClick={() => setBetaRecovery(false)} disabled={busy}>Back to log in</button></div>}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <span className="auth-wordmark">MELA</span>
      <h1>Welcome back</h1>
      <p className="auth-subtitle">Log in with your email or MELA beta username.</p>

      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {resetSent && <div className="banner banner-info" role="status">Check your email for a password reset link.</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="identifier">Email or beta username</label>
          <input id="identifier" autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? 'Hide password' : 'Show password'}</button>
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>

      <div className="auth-switch"><button type="button" onClick={forgotPassword} disabled={busy}>Forgot password?</button></div>
      <div className="auth-switch">New to MELA? <button type="button" onClick={onSwitchToRegister}>Use a beta access code</button></div>
    </AuthLayout>
  )
}
