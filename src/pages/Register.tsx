import AuthLayout from '../components/AuthLayout'
import { useMemo, useState } from 'react'
import { registerBetaUser, type BetaRegisterResult } from '../lib/auth'

export default function Register({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<BetaRegisterResult | null>(null)
  const [copied, setCopied] = useState(false)

  const passwordChecks = useMemo(() => ({
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
  }), [password])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const name = fullName.trim()
    const handle = username.trim().toLowerCase()

    if (name.length < 2) { setError('Please enter your full name.'); return }
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(handle)) {
      setError('Username must be 3–32 characters using letters, numbers, dot, dash, or underscore.')
      return
    }
    if (!passwordChecks.length || !passwordChecks.upper || !passwordChecks.lower || !passwordChecks.number) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, and a number.')
      return
    }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    if (accessCode.trim().length < 16) { setError('Enter your MELA beta access code.'); return }

    setBusy(true)
    try {
      const result = await registerBetaUser({ username: handle, password, fullName: name, accessCode })
      setCreated(result)
      setPassword('')
      setConfirmPassword('')
      setAccessCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the beta account.')
    } finally { setBusy(false) }
  }

  if (created) {
    return (
      <AuthLayout>
        <span className="auth-wordmark">MELA</span>
        <h1>Beta account ready</h1>
        <p className="auth-subtitle">Your username is <strong>{created.username}</strong>. Your access role is {created.role}.</p>
        <div className="banner banner-info" role="status">
          <strong>Save this recovery code now.</strong><br />
          It is the only way to reset your beta password without email.
        </div>
        <div className="field">
          <label htmlFor="recovery-code">Recovery code</label>
          <input id="recovery-code" readOnly value={created.recovery_code} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button className="btn btn-secondary btn-block" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(created.recovery_code); setCopied(true) } catch { setCopied(false) }
        }}>{copied ? 'Recovery code copied' : 'Copy recovery code'}</button>
        <button className="btn btn-primary btn-block" type="button" onClick={onSwitchToLogin}>Continue to log in</button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <span className="auth-wordmark">MELA</span>
      <h1>Join the MELA beta</h1>
      <p className="auth-subtitle">Beta access is invite-only while MELA launches on a zero-budget infrastructure plan.</p>

      {error && <div className="banner banner-error" role="alert">{error}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input id="fullName" required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} />
        </div>

        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" required minLength={3} maxLength={32} autoComplete="username" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} disabled={busy} />
          <span className="field-hint">3–32 characters: letters, numbers, dot, dash, or underscore.</span>
        </div>

        <div className="field">
          <label htmlFor="accessCode">Beta access code</label>
          <input id="accessCode" required autoComplete="off" spellCheck={false} value={accessCode} onChange={(e) => setAccessCode(e.target.value)} disabled={busy} />
          <span className="field-hint">Each access code works once and determines the account role.</span>
        </div>

        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-help" disabled={busy} />
          <span id="password-help" className="field-hint">At least 12 characters, with uppercase, lowercase, and a number.</span>
          <button type="button" className="btn btn-secondary" onClick={() => setShowPassword(v => !v)} disabled={busy} aria-pressed={showPassword}>{showPassword ? 'Hide password' : 'Show password'}</button>
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input id="confirmPassword" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={busy} />
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? 'Creating your beta account…' : 'Create beta account'}
        </button>
      </form>

      <div className="auth-switch">Already have an account? <button type="button" onClick={onSwitchToLogin}>Log in</button></div>
    </AuthLayout>
  )
}
