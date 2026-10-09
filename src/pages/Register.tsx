import { useI18n } from '../i18n'
import AuthLayout from '../components/AuthLayout'
import { useMemo, useState } from 'react'
import { registerBetaUser, type BetaRegisterResult } from '../lib/auth'

export default function Register({ onSwitchToLogin }: {
  onSwitchToLogin: () => void
  onRegistered?: (email: string) => void
}) {
  const { t } = useI18n()
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

    if (name.length < 2) { setError(t('authNameRequired')); return }
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(handle)) {
      setError(t('authUsernameRule'))
      return
    }
    if (!passwordChecks.length || !passwordChecks.upper || !passwordChecks.lower || !passwordChecks.number) {
      setError(t('authPasswordRule'))
      return
    }
    if (password !== confirmPassword) { setError(t('authMismatch')); return }
    if (accessCode.trim().length < 16) { setError(t('authEnterCode')); return }

    setBusy(true)
    try {
      const result = await registerBetaUser({ username: handle, password, fullName: name, accessCode })
      setCreated(result)
      setPassword('')
      setConfirmPassword('')
      setAccessCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authCreateError'))
    } finally { setBusy(false) }
  }

  if (created) {
    return (
      <AuthLayout>
        <span className="auth-wordmark">MELA</span>
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        <h1>{t('authReady')}</h1>
        <p className="auth-subtitle">{t('authUsername')}: <strong>{created.username}</strong>. {t('role')}: {created.role}.</p>
        <div className="banner banner-info" role="status">
          <strong>{t('authSaveCode')}</strong><br />
          {t('authCodeNotice')}
        </div>
        <div className="field">
          <label htmlFor="recovery-code">{t('authRecoveryCode')}</label>
          <input id="recovery-code" readOnly value={created.recovery_code} onFocus={(e) => e.currentTarget.select()} />
        </div>
        <button className="btn btn-secondary btn-block" type="button" onClick={async () => {
          try { await navigator.clipboard.writeText(created.recovery_code); setCopied(true); setError('') } catch { setCopied(false); setError(t('authCopyError')) }
        }}>{copied ? t('authCodeCopied') : t('authCopyCode')}</button>
        <button className="btn btn-primary btn-block" type="button" onClick={onSwitchToLogin}>{t('authContinueLogin')}</button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <span className="auth-wordmark">MELA</span>
      <h1>{t('authJoin')}</h1>
      <p className="auth-subtitle">{t('authJoinHelp')}</p>

      {error && <div className="banner banner-error" role="alert">{error}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="fullName">{t('authFullName')}</label>
          <input id="fullName" required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={busy} />
        </div>

        <div className="field">
          <label htmlFor="username">{t('authUsername')}</label>
          <input id="username" required minLength={3} maxLength={32} autoComplete="username" spellCheck={false} value={username} onChange={(e) => setUsername(e.target.value)} disabled={busy} />
          <span className="field-hint">{t('authUsernameRule')}</span>
        </div>

        <div className="field">
          <label htmlFor="accessCode">{t('authAccessCode')}</label>
          <input id="accessCode" required autoComplete="off" spellCheck={false} value={accessCode} onChange={(e) => setAccessCode(e.target.value)} disabled={busy} />
          <span className="field-hint">{t('authCodeHelp')}</span>
        </div>

        <div className="field">
          <label htmlFor="password">{t('authPassword')}</label>
          <input id="password" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby="password-help" disabled={busy} />
          <span id="password-help" className="field-hint">{t('authPasswordRule')}</span>
          <button type="button" className="btn btn-secondary" onClick={() => setShowPassword(v => !v)} disabled={busy} aria-pressed={showPassword}>{showPassword ? t('authHide') : t('authShow')}</button>
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">{t('authConfirm')}</label>
          <input id="confirmPassword" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={busy} />
        </div>

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? t('authCreating') : t('authCreate')}
        </button>
      </form>

      <div className="auth-switch">{t('authExisting')} <button type="button" onClick={onSwitchToLogin}>{t('authLogin')}</button></div>
    </AuthLayout>
  )
}
