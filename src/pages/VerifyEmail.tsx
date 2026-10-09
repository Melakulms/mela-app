import { useI18n } from '../i18n'
import AuthLayout from '../components/AuthLayout'
import { authRedirectUrl } from '../lib/auth-redirect'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logoutUser } from '../lib/auth'

export default function VerifyEmail({ email, onUseDifferentAccount, onRefresh }: { email: string; onUseDifferentAccount: () => void; onRefresh?: () => void }) {
  const { t } = useI18n()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const resend = async () => {
    setBusy(true)
    setError('')
    try {
      const { error: resendError } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } })
      if (resendError) setError(resendError.message)
      else setSent(true)
    } catch { setError(t('authVerifyError')) }
    finally { setBusy(false) }
  }

  const changeAccount = async () => {
    setBusy(true); setError('')
    try {
      const { error } = await logoutUser()
      if (error) throw error
      onUseDifferentAccount()
    } catch { setError(t('authSignoutError')) }
    finally { setBusy(false) }
  }

  return (
    <AuthLayout>
        <span className="auth-wordmark">MELA</span>
        <h1>{t('authConfirmEmail')}</h1>
        <p className="auth-subtitle">
          <strong>{email}</strong>. {t('authVerifyHelp')}
        </p>

        {error && <div className="banner banner-error">{error}</div>}
        {sent && <div className="banner banner-info">{t('authResent')}</div>}

        <button className="btn btn-secondary btn-block" onClick={resend} disabled={busy}>
          {busy ? t('loading') : t('authResend')}
        </button>
        {onRefresh && <button className="btn btn-primary btn-block" onClick={onRefresh} disabled={busy}>{t('authConfirmedEmail')}</button>}
        <div className="auth-switch">
          <button type="button" onClick={changeAccount} disabled={busy}>{t('authDifferentAccount')}</button>
        </div>
    </AuthLayout>
  )
}
