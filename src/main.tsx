import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
const App = lazy(() => import('./App'))
const CertificateVerification = lazy(() => import('./pages/CertificateVerification'))
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

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
