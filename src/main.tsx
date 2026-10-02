import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
const App = lazy(() => import('./App'))
import ErrorBoundary from './components/ErrorBoundary'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><Suspense fallback={<div className="centered-loading" role="status">Loading MELA…</div>}><App /></Suspense></ErrorBoundary>
  </StrictMode>,
)
