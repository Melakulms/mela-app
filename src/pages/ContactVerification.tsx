import { useState } from 'react'
import { authRedirectUrl } from '../lib/auth-redirect'
import { validContactPhone } from '../lib/contact-verification'
import { supabase } from '../lib/supabase'

/** Completing an invitation confirms possession of a code, not a real contact.
 * Keep all account features closed until Supabase Auth confirms email or phone.
 */
export default function ContactVerification({ onRefresh, onSignOut }: {
  onRefresh: () => void
  onSignOut: () => void
}) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [sentPhone, setSentPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const updateEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(''); setMessage(''); setBusy(true)
    try {
      const normalized = email.trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.endsWith('@beta.mela.invalid')) {
        throw new Error('Enter a real email address you control.')
      }
      const { error: resultError } = await supabase.auth.updateUser({email: normalized}, {emailRedirectTo:authRedirectUrl()})
      if (resultError) throw resultError
      setMessage('Check the confirmation email. Your MELA access will open only after the new address is verified.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request email verification.')
    } finally { setBusy(false) }
  }

  const sendPhoneOtp = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(''); setMessage(''); setBusy(true)
    try {
      const normalized = phone.trim()
      if (!validContactPhone(normalized)) throw new Error('Enter your number in international format, for example +2519XXXXXXXX.')
      const { error: resultError } = await supabase.auth.updateUser({phone:normalized})
      if (resultError) throw resultError
      setSentPhone(normalized)
      setMessage('If SMS delivery is enabled, enter the code sent to your phone. Do not share the code with MELA staff or the Telegram bot.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'SMS verification is unavailable. You can try email verification instead.')
    } finally { setBusy(false) }
  }

  const confirmPhone = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(''); setMessage(''); setBusy(true)
    try {
      if (!sentPhone || !/^\d{4,10}$/.test(otp.trim())) throw new Error('Enter the verification code sent to your phone.')
      const {error: resultError} = await supabase.auth.verifyOtp({phone:sentPhone,token:otp.trim(),type:'phone_change'})
      if (resultError) throw resultError
      const {data:auth,error:userError} = await supabase.auth.getUser()
      if (userError || !auth.user?.phone_confirmed_at || auth.user.phone !== sentPhone) {
        throw new Error('Phone confirmation is not yet reflected in your account. Refresh your session and check again.')
      }
      setOtp('')
      setMessage('Your phone number has been verified. Checking your MELA account…')
      onRefresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not confirm the SMS code.')
    } finally { setBusy(false) }
  }

  return <main className="auth-shell"><div className="auth-card" style={{maxWidth:700}}>
    <span className="auth-wordmark">MELA</span>
    <h1>Verify a real contact</h1>
    <p className="auth-subtitle">Your invitation or Telegram code created an account, but it did not verify a phone number or email address. To protect learners and account recovery, MELA needs one verified contact before enabling your private dashboard.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {message && <div className="banner banner-info" role="status">{message}</div>}
    <form onSubmit={updateEmail}>
      <div className="field">
        <label htmlFor="contact-real-email">Email address to verify</label>
        <input id="contact-real-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Send confirmation email</button>
    </form>
    <p className="field-hint">Or verify a mobile number using a provider-delivered OTP. SMS delivery must be configured in Supabase for this option to work.</p>
    <form onSubmit={sendPhoneOtp}>
      <div className="field">
        <label htmlFor="contact-mobile">Mobile number (international format)</label>
        <input id="contact-mobile" type="tel" inputMode="tel" autoComplete="tel" placeholder="+2519XXXXXXXX" required value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy}/>
      </div>
      <button type="submit" className="btn btn-secondary btn-block" disabled={busy}>Send SMS verification code</button>
    </form>
    {sentPhone && <form onSubmit={confirmPhone}>
      <div className="field">
        <label htmlFor="contact-phone-code">SMS code sent to {sentPhone}</label>
        <input id="contact-phone-code" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={e=>setOtp(e.target.value)} disabled={busy} required/>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>Verify phone</button>
    </form>}
    <button type="button" className="btn btn-secondary btn-block" onClick={onRefresh} disabled={busy}>I already verified — check again</button>
    <button type="button" className="btn btn-secondary btn-block" onClick={onSignOut} disabled={busy}>Sign out</button>
  </div></main>
}
