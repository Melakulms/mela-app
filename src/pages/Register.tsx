import { useMemo, useState } from 'react'
import { registerUser, type MelaRole } from '../lib/auth'

const ROLES: { value: Extract<MelaRole, 'student' | 'parent' | 'teacher' | 'company'>; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent / Guardian' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'company', label: 'Employer / Company' },
]

export default function Register({ onSwitchToLogin, onRegistered }: {
  onSwitchToLogin: () => void
  onRegistered: (email: string) => void
}) {
  const [role, setRole] = useState<Extract<MelaRole, 'student' | 'parent' | 'teacher' | 'company'>>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const passwordChecks = useMemo(() => ({
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\\d/.test(password),
  }), [password])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const name = fullName.trim()
    const address = email.trim().toLowerCase()

    if (name.length < 2) {
      setError('Please enter your full name.')
      return
    }
    if (!passwordChecks.length || !passwordChecks.upper || !passwordChecks.lower || !passwordChecks.number) {
      setError('Password must be at least 12 characters and include uppercase, lowercase, and a number.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    const { error: signUpError } = await registerUser({
      email: address,
      password,
      fullName: name,
      role,
    })
    setBusy(false)

    if (signUpError) {
      const message = signUpError.message.toLowerCase()
      if (message.includes('already registered') || message.includes('already exists') || message.includes('user already')) {
        setError('An account with this email already exists. Please log in or use a different email.')
      } else if (message.includes('rate limit')) {
        setError('Too many registration attempts. Please wait a few minutes and try again.')
      } else {
        setError(signUpError.message)
      }
      return
    }

    onRegistered(address)
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="auth-wordmark">MELA</span>
        <h1>Start your career passport</h1>
        <p className="auth-subtitle">One account, built around where you're headed.</p>

        {error && <div className="banner banner-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label>I am a...</label>
            <div className="role-grid" role="group" aria-label="Account type">
              {ROLES.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  className="role-option"
                  aria-pressed={role === r.value}
                  onClick={() => setRole(r.value)}
                  disabled={busy}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" required minLength={2} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type={showPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-help" />
            <span id="password-help" className="field-hint">At least 12 characters, with uppercase, lowercase, and a number.</span>
            <button type="button" className="btn btn-secondary" onClick={() => setShowPassword(v => !v)} disabled={busy} aria-pressed={showPassword}>{showPassword ? "Hide password" : "Show password"}</button>
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" type={showPassword ? "text" : "password"} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? 'Creating your account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-switch">
          Already have an account? <button type="button" onClick={onSwitchToLogin}>Log in</button>
        </div>
      </div>
    </div>
  )
}
