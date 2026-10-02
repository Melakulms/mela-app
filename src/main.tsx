import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
const App = lazy(() => import('./App'))
const CertificateVerification = lazy(() => import('./pages/CertificateVerification'))
import ErrorBoundary from './components/ErrorBoundary'
import { clearLegacyAdminSession } from './lib/security-boundary'
import './styles.css'

// Historical admin deployments shared this origin and persisted a privileged
// Supabase session. Remove that legacy credential before rendering any MELA UI.
clearLegacyAdminSession()

const certificateCode = new URLSearchParams(window.location.search).get('certificate')?.trim() ?? ''

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <Suspense fallback={<div className="centered-loading" role="status">Loading MELA…</div>}>
        {certificateCode ? <CertificateVerification code={certificateCode} /> : <App />}
      </Suspense>
    </ErrorBoundary>
  </StrictMode>,
)
