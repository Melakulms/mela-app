import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { logoutUser } from '../lib/auth'

export default function VerifyEmail({ email, onUseDifferentAccount }: { email: string; onUseDifferentAccount: () => void }) {
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const resend = async () => {
    setBusy(true)
    setError('')
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
    setBusy(false)
    if (resendError) setError(resendError.message)
    else setSent(true)
  }

  const changeAccount = async () => {\n    await logoutUser()\n    onUseDifferentAccount()\n  }\n\n  return (
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
        <div className="auth-switch">
          <button type="button" onClick={changeAccount}>Use a different account</button>
        </div>
      </div>
    </div>
  )
}
