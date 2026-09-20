import { useState } from 'react'
import { loginUser, requestPasswordReset } from '../lib/auth'

export default function Login({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: loginError } = await loginUser(email, password)
    setBusy(false)
    if (loginError) setError(loginError.message)
  }

  const forgotPassword = async () => {
    if (!email) {
      setError('Enter your email above first, then tap "Forgot password".')
      return
    }
    setError('')
    const { error: resetError } = await requestPasswordReset(email)
    if (resetError) setError(resetError.message)
    else setResetSent(true)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="auth-wordmark">MELA</span>
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Log in to keep building your career passport.</p>

        {error && <div className="banner banner-error">{error}</div>}
        {resetSent && <div className="banner banner-info">Check your email for a password reset link.</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="auth-switch">
          <button type="button" onClick={forgotPassword}>Forgot password?</button>
        </div>
        <div className="auth-switch">
          New to MELA? <button type="button" onClick={onSwitchToRegister}>Create an account</button>
        </div>
      </div>
    </div>
  )
}
