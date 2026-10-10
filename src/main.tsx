import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
const App = lazy(() => import('./App'))
const CertificateVerification = lazy(() => import('./pages/CertificateVerification'))
import ErrorBoundary from './components/ErrorBoundary'
import InstallApp from './components/InstallApp'
import { I18nProvider } from './i18n'
import { clearLegacyAdminSession } from './lib/security-boundary'
import './styles.css'
import './phase6.css'

// Historical admin deployments shared this origin and persisted a privileged
// Supabase session. Remove that legacy credential before rendering any MELA UI.
clearLegacyAdminSession()

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('sw.js', document.baseURI).toString()
    void navigator.serviceWorker.register(serviceWorkerUrl, { scope: new URL('.', document.baseURI).pathname }).catch(() => {})
  })
}

const certificateCode = new URLSearchParams(window.location.search).get('certificate')?.trim() ?? ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <ErrorBoundary>
        <InstallApp />
        <Suspense fallback={<div className="centered-loading" role="status">Loading MELA…</div>}>
          {certificateCode ? <CertificateVerification code={certificateCode} /> : <App />}
        </Suspense>
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
