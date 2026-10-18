import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
const App = lazy(() => import('./App'))
const CertificateVerification = lazy(() => import('./pages/CertificateVerification'))
import ErrorBoundary from './components/ErrorBoundary'
import InstallApp from './components/InstallApp'
import DeviceSettings from './components/DeviceSettings'
import { I18nProvider } from './i18n'
import { clearLegacyAdminSession } from './lib/security-boundary'
import { AUTH_STORAGE_KEY } from './lib/supabase'
import './styles.css'
import './phase6.css'

// Historical admin deployments shared this origin and persisted a privileged
// Supabase session. Remove that legacy credential before rendering any MELA UI.
clearLegacyAdminSession()
// Never restore an old authenticated DOM snapshot with the browser Back button.
window.addEventListener('pageshow', event => { if (event.persisted) window.location.reload() })
window.addEventListener('storage', event => {
  if (event.key === AUTH_STORAGE_KEY && event.oldValue && !event.newValue) {
    window.location.replace(import.meta.env.BASE_URL + '?signed_out=1')
  }
})

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
        <a href={`${import.meta.env.BASE_URL}offline.html`} style={{display:'block',textAlign:'center',padding:8}}>Offline library · public study materials</a>
        <DeviceSettings />
        <Suspense fallback={<div className="centered-loading" role="status">Loading MELA…</div>}>
          {certificateCode ? <CertificateVerification code={certificateCode} /> : <App />}
        </Suspense>
      </ErrorBoundary>
    </I18nProvider>
  </StrictMode>,
)
