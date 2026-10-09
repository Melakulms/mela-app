import { useI18n } from '../i18n'
import AuthLayout from '../components/AuthLayout'
import { useState } from 'react'
import { loginUser, requestPasswordReset, resetBetaPassword } from '../lib/auth'

export default function Login({ onSwitchToRegister }: { onSwitchToRegister: () => void }) {
  const { t } = useI18n()
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
  const [codeCopied, setCodeCopied] = useState(false)
  const [nextRecoveryCode, setNextRecoveryCode] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const { error: loginError } = await loginUser(identifier, password)
      if (loginError) setError(loginError.message)
    } catch { setError(t('connectionError')) }
    finally { setBusy(false) }
  }

  const forgotPassword = async () => {
    const value = identifier.trim()
    if (!value) { setError(t('authEnterIdentifier')); return }
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
    } catch { setError(t('authResetEmailError')) }
    finally { setBusy(false) }
  }

  const submitBetaRecovery = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 12 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError(t('authPasswordRule'))
      return
    }
    if (newPassword !== confirmNewPassword) { setError(t('authNewMismatch')); return }
    setBusy(true)
    try {
      const result = await resetBetaPassword(identifier, recoveryCode, newPassword)
      setNextRecoveryCode(result.recovery_code)
      setRecoveryCode('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authResetError'))
    } finally { setBusy(false) }
  }

  if (betaRecovery) {
    return (
      <AuthLayout>
        <span className="auth-wordmark">MELA</span>
        <h1>{t('authRecoverBeta')}</h1>
        <p className="auth-subtitle"><strong>{identifier.trim().toLowerCase()}</strong> — {t('authRecoveryHelp')}</p>
        {error && <div className="banner banner-error" role="alert">{error}</div>}
        {nextRecoveryCode ? (
          <>
            <div className="banner banner-info" role="status"><strong>{t('authChanged')}</strong> {t('authRotateNotice')}</div>
            <div className="field"><label htmlFor="nextRecoveryCode">{t('authNewRecoveryCode')}</label><input id="nextRecoveryCode" readOnly value={nextRecoveryCode} onFocus={(e) => e.currentTarget.select()} /></div>
            <button type="button" className="btn btn-secondary btn-block" onClick={async () => { try { await navigator.clipboard.writeText(nextRecoveryCode); setError(''); setCodeCopied(true) } catch { setError(t('authCopyError')) } }}>{codeCopied ? t('authCodeCopied') : t('authCopyNewCode')}</button>
            <button type="button" className="btn btn-primary btn-block" onClick={() => { setBetaRecovery(false); setNextRecoveryCode('') }}>{t('authReturnLogin')}</button>
          </>
        ) : (
          <form onSubmit={submitBetaRecovery}>
            <div className="field"><label htmlFor="recoveryCode">{t('authRecoveryCode')}</label><input id="recoveryCode" required autoComplete="off" spellCheck={false} value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} disabled={busy} /></div>
            <div className="field"><label htmlFor="newPassword">{t('authNewPassword')}</label><input id="newPassword" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={busy} /></div>
            <div className="field"><label htmlFor="confirmNewPassword">{t('authConfirmNew')}</label><input id="confirmNewPassword" type={showPassword ? 'text' : 'password'} required minLength={12} autoComplete="new-password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} disabled={busy} /></div>
            <button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? t('authHideMany') : t('authShowMany')}</button>
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? t('authResetting') : t('authResetBeta')}</button>
          </form>
        )}
        {!nextRecoveryCode && <div className="auth-switch"><button type="button" onClick={() => setBetaRecovery(false)} disabled={busy}>{t('authReturnLogin')}</button></div>}
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <span className="auth-wordmark">MELA</span>
      <h1>{t('authWelcome')}</h1>
      <p className="auth-subtitle">{t('authLoginHelp')}</p>

      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {resetSent && <div className="banner banner-info" role="status">{t('authResetEmailSent')}</div>}

      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="identifier">{t('authIdentifier')}</label>
          <input id="identifier" autoComplete="username" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">{t('authPassword')}</label>
          <input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>{showPassword ? t('authHide') : t('authShow')}</button>
        </div>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>{busy ? t('authLoggingIn') : t('authLogin')}</button>
      </form>

      <div className="auth-switch"><button type="button" onClick={forgotPassword} disabled={busy}>{t('authForgot')}</button></div>
      <div className="auth-switch">{t('authNewHere')} <button type="button" onClick={onSwitchToRegister}>{t('authUseCode')}</button></div>
    </AuthLayout>
  )
}
