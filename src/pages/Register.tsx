import { useState } from 'react'
import { registerUser, type MelaRole } from '../lib/auth'

const ROLES: { value: MelaRole; label: string }[] = [
  { value: 'student', label: 'Student' },
  { value: 'parent', label: 'Parent / Guardian' },
  { value: 'teacher', label: 'Teacher' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'company', label: 'Employer' },
]

export default function Register({ onSwitchToLogin, onRegistered }: {
  onSwitchToLogin: () => void
  onRegistered: (email: string) => void
}) {
  const [role, setRole] = useState<MelaRole>('student')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 12) {
      setError('Password needs to be at least 12 characters.')
      return
    }
    setBusy(true)
    const { error: signUpError } = await registerUser({ email, password, fullName, role })
    setBusy(false)
    if (signUpError) {
      setError(signUpError.message)
      return
    }
    onRegistered(email)
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
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} />
            <span className="field-hint">At least 12 characters.</span>
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
