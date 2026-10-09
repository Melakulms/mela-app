import AuthLayout from '../components/AuthLayout'
import { useI18n } from '../i18n'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword({ sessionReady, onComplete }: { sessionReady: boolean; onComplete: () => void }) {
  const { t } = useI18n()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (password.length < 12 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError(t('authPasswordRule'))
      return
    }
    if (password !== confirmation) { setError(t('authMismatch')); return }
    setBusy(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setPassword('')
      setConfirmation('')
      setSaved(true)
    } catch (error) {
      setError(error instanceof Error ? error.message : t('authUpdateError'))
    } finally { setBusy(false) }
  }

  return <AuthLayout>
    <span className="auth-wordmark">MELA</span><h1>{t('authResetTitle')}</h1>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {saved ? <><p role="status">{t('authUpdated')}</p><button className="btn btn-primary btn-block" onClick={onComplete}>{t('authContinueMela')}</button></>
      : !sessionReady ? <><p>{t('authInvalidReset')}</p><button className="btn btn-secondary" onClick={onComplete}>{t('authReturnLogin')}</button></>
      : <form onSubmit={submit}>
        <div className="field"><label htmlFor="new-password">{t('authNewPassword')}</label><input id="new-password" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} /></div>
        <p className="field-hint">{t('authPasswordRule')}</p>
        <div className="field"><label htmlFor="confirm-new-password">{t('authConfirm')}</label><input id="confirm-new-password" type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} /></div>
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? t('loading') : t('authSavePassword')}</button>
      </form>}
  </AuthLayout>
}
