import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
const App = lazy(() => import('./App'))
const CertificateVerification = lazy(() => import('./pages/CertificateVerification'))
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

// The learner app currently shares an origin with historical admin deployments.
// Older admin builds persisted a privileged Supabase session under this key.
// Clear it here as well so visiting any MELA surface removes that stale credential.
try { window.localStorage.removeItem('mela-central-admin-auth') } catch { /* storage may be unavailable */ }

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
