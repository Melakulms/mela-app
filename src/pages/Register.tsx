import { useI18n } from '../i18n'
import { telegramRegistrationLink } from '../lib/telegram-registration'
import AuthLayout from '../components/AuthLayout'
import GradeSelectionPreview from '../components/GradeSelectionPreview'
import { useMemo, useState } from 'react'
import { registerBetaUser, registerUser, type BetaRegisterResult, type BetaSignupRole } from '../lib/auth'

export default function Register({ onSwitchToLogin, onRegistered }: {
  onSwitchToLogin: () => void
  onRegistered?: (email: string) => void
}) {
  const { t } = useI18n()
  const [mode, setMode] = useState<'email' | 'invite'>(() =>
    new URLSearchParams(window.location.search).get('signup') === 'email' ? 'email' : 'invite')
  const [emailDeliveryBlocked, setEmailDeliveryBlocked] = useState(false)
  const [email, setEmail] = useState('')
  const [emailRole, setEmailRole] = useState<BetaSignupRole>('student')
  const [emailSent, setEmailSent] = useState(false)
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [role, setRole] = useState<BetaSignupRole | ''>('')
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

    if (mode === 'email') {
      const normalizedEmail = email.trim().toLowerCase()
      if (name.length < 2) { setError(t('authNameRequired')); return }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setError(t('authEmailInvalid')); return }
      if (password.length < 12) { setError(t('authEmailPasswordHelp')); return }
      if (password !== confirmPassword) { setError(t('authMismatch')); return }
      setBusy(true)
      setEmailDeliveryBlocked(false)
      try {
        const { data: signupData, error: signupError } = await registerUser({
          email: normalizedEmail, password, fullName: name, role: emailRole,
        })
        if (signupError) throw signupError
        if (!signupData?.user) throw new Error(t('authCreateError'))
        setPassword(''); setConfirmPassword('')
        setEmailSent(true)
        onRegistered?.(normalizedEmail)
      } catch (err) {
        const message = err && typeof err === 'object' && 'message' in err && typeof err.message === 'string' ? err.message : ''
        const deliveryProblem = /error sending confirmation email|535\s+5\.7\.8|smtp|email delivery|mail provider/i.test(message)
        setEmailDeliveryBlocked(deliveryProblem)
        setError(deliveryProblem ? t('authEmailDeliveryIssue') : (message || t('authEmailCreateError')))
      } finally { setBusy(false) }
      return
    }

    if (!role) { setError('Select your account type before creating your MELA account.'); return }
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
      const result = await registerBetaUser({ username: handle, password, fullName: name, accessCode, role })
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


  if (mode === 'email') {
    return (
      <AuthLayout>
        <span className="auth-wordmark">MELA</span>
        <h1>{t('authEmailJoin')}</h1>
        <p className="auth-subtitle">{t('authEmailHelp')} Email signup requires a confirmation email. If delivery is unavailable, use an administrator-issued invitation to register without email.</p>
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        {emailDeliveryBlocked && <div className="banner banner-info" role="status">
          You can register without email delivery using a one-time invitation from an authorized MELA administrator.
          <button type="button" className="btn btn-primary btn-block" onClick={() => { setMode('invite'); setError(''); setEmailDeliveryBlocked(false) }}>
            Register with an invitation code
          </button>
        </div>}
        {emailSent && <div className="banner banner-info" role="status">{t('authEmailSent')}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="fullName">{t('authFullName')}</label>
            <input id="fullName" required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} disabled={busy} />
          </div>
          <div className="field">
            <label htmlFor="email">{t('authEmailAddress')}</label>
            <input id="email" type="email" inputMode="email" required autoCapitalize="none" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} disabled={busy} />
          </div>
          <div className="field">
            <label htmlFor="email-role">{t('authEmailRole')}</label>
            <select id="email-role" required value={emailRole} onChange={e => setEmailRole(e.target.value as BetaSignupRole)} disabled={busy}>
              <option value="student">{t('authEmailStudent')}</option>
              <option value="parent">{t('authEmailParent')}</option>
              <option value="teacher">{t('authEmailTeacher')}</option>
              <option value="company">{t('authEmailCompany')}</option>
            </select>
            {(emailRole === 'teacher' || emailRole === 'company') && <span className="field-hint" role="status">{t('authProfessionalVerification')}</span>}
            {emailRole === 'student' && <span className="field-hint" role="status">After confirming your account and signing in, choose your actual school grade (1–12) or college/university level in mandatory education setup. There is no random or preselected grade. Question Bank uses only your saved grade.</span>}
          </div>
          <div className="field">
            <label htmlFor="password">{t('authPassword')}</label>
            <input id="password" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} aria-describedby="email-password-help" />
            <span id="email-password-help" className="field-hint">{t('authEmailPasswordHelp')}</span>
            <button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} disabled={busy} aria-pressed={showPassword}>{showPassword ? t('authHide') : t('authShow')}</button>
          </div>
          <div className="field">
            <label htmlFor="confirmPassword">{t('authConfirm')}</label>
            <input id="confirmPassword" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={busy} />
          </div>
          {emailRole === 'student' && <GradeSelectionPreview />}
          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? t('authCreating') : t('authEmailSubmit')}</button>
        </form>
        <div className="auth-switch">{t('authExisting')} <button type="button" onClick={onSwitchToLogin}>{t('authLogin')}</button></div>
        <div className="auth-switch"><button type="button" disabled={busy} onClick={() => { setMode('invite'); setError('') }}>{t('authSwitchInvite')}</button></div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <span className="auth-wordmark">MELA</span>
      <h1>{t('authJoin')}</h1>
      <p className="auth-subtitle">{t('authJoinHelp')} Register without email using a private Telegram verification code or an administrator invitation. Telegram verifies account control, not legal identity. Guardian consent and professional verification are separate checks.</p>
      <div className="banner banner-info">
        <strong>Start learning now — no account needed</strong>
        <p>Try free maths practice and read the AI foundations handbook. The handbook is a draft awaiting teacher review. These public resources do not save progress to an account.</p>
        <a className="btn btn-secondary btn-block" href={`${import.meta.env.BASE_URL}offline.html`}>Open free study library</a>
        <p>No invitation yet? Enter your username and account type below, then get a verification code from our Telegram bot. Never send your password or recovery code to the bot.</p>
      </div>
      <div className="auth-switch"><button type="button" disabled={busy} onClick={() => { setMode('email'); setError('') }}>{t('authSwitchEmail')}</button></div>

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
          <label htmlFor="registration-role">Account type (required)</label>
          <select id="registration-role" required value={role} onChange={event => {setRole(event.target.value as BetaSignupRole);setError('')}} disabled={busy}>
            <option value="" disabled>Select an account type</option>
            <option value="student">Student / learner</option>
            <option value="parent">Parent / family or guardian</option>
            <option value="teacher">Teacher / educator</option>
            <option value="company">Employer / organization</option>
          </select>
          <span className="field-hint">Your Telegram code or administrator invitation must match this account type. A mismatch is rejected without using your code. Teacher and employer privileges require independent verification.</span>
          {role === 'student' && <span className="field-hint" role="status">After signing in, complete mandatory registration setup by selecting your school grade (1–12) or college/university level. Practice uses the saved grade, not a separate grade picker.</span>}
        </div>

        <div className="banner banner-info">
          <strong>Verify with Telegram — no email needed</strong>
          <p>1. Choose your username and account type. 2. Open the bot and tap Start. 3. Copy its private code into the field below within 10 minutes, then create your account.</p>
          {telegramRegistrationLink(username, role)
            ? <a className="btn btn-secondary btn-block" href={telegramRegistrationLink(username, role)!} target="_blank" rel="noopener noreferrer">Get Telegram verification code</a>
            : <p>Enter a valid username and select an account type to open Telegram verification.</p>}
          <p>One Telegram account can verify one MELA account. No Telegram? Use an administrator invitation. Keep your recovery code for password recovery.</p>
        </div>
        <div className="field">
          <label htmlFor="accessCode">{t('authAccessCode')}</label>
          <input id="accessCode" required autoComplete="off" spellCheck={false} value={accessCode} onChange={(e) => setAccessCode(e.target.value)} disabled={busy} />
          <span className="field-hint">Paste your Telegram verification code or administrator invitation here. Telegram codes expire after 10 minutes and work only once for the chosen username.</span>
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

        {role === 'student' && <GradeSelectionPreview />}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? t('authCreating') : t('authCreate')}
        </button>
      </form>

      <div className="auth-switch">{t('authExisting')} <button type="button" onClick={onSwitchToLogin}>{t('authLogin')}</button></div>
    </AuthLayout>
  )
}
