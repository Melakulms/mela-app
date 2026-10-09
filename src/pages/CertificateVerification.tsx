import { useI18n } from '../i18n'
import { useEffect, useState } from 'react'
import { verifyCourseCertificate, type VerifiedCourseCertificate } from '../lib/passport'

export default function CertificateVerification({ code }: { code: string }) {
  const { t, language } = useI18n()
  const [result, setResult] = useState<VerifiedCourseCertificate | null | undefined>(undefined)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setResult(undefined)
    setError('')
    verifyCourseCertificate(code)
      .then((row) => { if (active) setResult(row) })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not verify this credential.') })
    return () => { active = false }
  }, [code, revision])

  const returnToMela = () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('certificate')
    window.location.assign(url.toString())
  }

  return <main className="auth-shell">
    <section className="auth-card" aria-labelledby="certificate-heading">
      <span className="auth-wordmark">MELA</span>
      <h1 id="certificate-heading">{t('credentialVerification')}</h1>
      <p className="auth-subtitle">{t('credentialVerificationHelp')}</p>
      {error && <div className="banner banner-error" role="alert">{error}<button className="btn btn-secondary" onClick={() => setRevision((value) => value + 1)}>{t('retry')}</button></div>}
      {!error && result === undefined && <p role="status">{t('credentialVerifying')}</p>}
      {!error && result === null && <div className="banner banner-error" role="status">{t('credentialMissing')}</div>}
      {result && <div className="list-panel">
        <div className="list-row"><span>{t('credential')}</span><strong>{result.credential_type}</strong></div>
        <div className="list-row"><span>{t('course')}</span><strong>{result.course_title}</strong></div>
        <div className="list-row"><span>{t('learner')}</span><strong>{result.learner_name}</strong></div>
        <div className="list-row"><span>{t('issued')}</span><strong>{new Date(result.issued_at).toLocaleDateString(language)}</strong></div>
        <div className="list-row"><span>{t('code')}</span><code>{result.certificate_code}</code></div>
        <div className="list-row"><span>{t('status')}</span><span className="pill">{result.valid ? t('valid') : t('revoked')}</span></div>
      </div>}
      <button className="btn btn-primary" onClick={returnToMela}>{t('goToMela')}</button>
    </section>
  </main>
}
