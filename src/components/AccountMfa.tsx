import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PendingFactor = { id: string; qrCode: string; secret: string }

export default function AccountMfa() {
  const [verified, setVerified] = useState(0)
  const [pending, setPending] = useState<PendingFactor | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function refresh() {
    const { data, error: listError } = await supabase.auth.mfa.listFactors()
    if (listError) throw listError
    setVerified(data?.totp.filter(factor => factor.status === 'verified').length ?? 0)
  }
  useEffect(() => { void refresh().catch(() => setError('Could not load multi-factor settings.')) }, [])

  async function enroll() {
    setBusy(true); setError(''); setNotice('')
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'MELA authenticator',
      })
      if (enrollError) throw enrollError
      if (!data.totp?.qr_code || !data.totp?.secret) throw new Error('Authenticator enrollment did not return a setup code.')
      setPending({ id: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start authenticator setup.')
    } finally { setBusy(false) }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault()
    if (!pending || !/^\d{6}$/.test(code) || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: pending.id })
      if (challengeError) throw challengeError
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: pending.id, challengeId: challenge.id, code,
      })
      if (verifyError) throw verifyError
      setPending(null); setCode('')
      setNotice('Authenticator verified. Future password logins require the authenticator code.')
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not verify this code.')
    } finally { setBusy(false) }
  }

  return <div className="settings-mfa">
    <h3>Authenticator-app verification</h3>
    <p>{verified ? `${verified} verified authenticator factor(s) on this account.` : 'Add an authenticator app for stronger sign-in protection.'}</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {notice && <div className="banner banner-info" role="status">{notice}</div>}
    {!pending ? <button type="button" className="btn btn-secondary" onClick={() => void enroll()} disabled={busy}>
      {busy ? 'Starting setup…' : 'Add authenticator'}
    </button> : <form onSubmit={event => void verify(event)}>
      <p>Scan this QR code with an authenticator app, or enter the secret manually. Keep the secret private.</p>
      <img className="settings-mfa-qr" src={pending.qrCode} alt="Authenticator enrollment QR code" />
      <label className="settings-field">Manual setup key
        <input readOnly value={pending.secret} onFocus={e => e.target.select()} autoComplete="off" />
      </label>
      <label className="settings-field">Six-digit code
        <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" inputMode="numeric" maxLength={6} pattern="[0-9]{6}" required />
      </label>
      <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify authenticator'}</button>
      <p className="settings-note">If setup is interrupted, you can start another enrollment. Do not share your QR code or manual secret.</p>
    </form>}
    <p className="settings-note">Supabase does not issue MFA recovery codes. Add a second authenticator as backup if possible. Removing factors requires a separate verified account-recovery flow.</p>
  </div>
}
