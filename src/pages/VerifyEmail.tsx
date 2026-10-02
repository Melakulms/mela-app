import { authRedirectUrl } from '../lib/auth-redirect'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logoutUser } from '../lib/auth'

export default function VerifyEmail({ email, onUseDifferentAccount, onRefresh }: { email: string; onUseDifferentAccount: () => void; onRefresh?: () => void }) {
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
    } catch { setError('Could not send your verification email. Please try again.') }
    finally { setBusy(false) }
  }

  const changeAccount = async () => {
    setBusy(true); setError('')
    try {
      const { error } = await logoutUser()
      if (error) throw error
      onUseDifferentAccount()
    } catch { setError('Could not sign out. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="auth-wordmark">MELA</span>
        <h1>Confirm your email</h1>
        <p className="auth-subtitle">
          We sent a confirmation link to <strong>{email}</strong>. Open it to activate your account, then come back here.
        </p>

        {error && <div className="banner banner-error">{error}</div>}
        {sent && <div className="banner banner-info">Sent again — check your inbox.</div>}

        <button className="btn btn-secondary btn-block" onClick={resend} disabled={busy}>
          {busy ? 'Sending…' : 'Resend email'}
        </button>
        {onRefresh && <button className="btn btn-primary btn-block" onClick={onRefresh} disabled={busy}>I have confirmed my email</button>}
        <div className="auth-switch">
          <button type="button" onClick={changeAccount} disabled={busy}>Use a different account</button>
        </div>
      </div>
    </div>
  )
}
