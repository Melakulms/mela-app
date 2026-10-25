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
import './pwa-update.css'

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
  let hadController = Boolean(navigator.serviceWorker.controller)
  let updateAvailable = false

  const offerInstalledAppRefresh = () => {
    if (!updateAvailable || document.getElementById('mela-pwa-update-notice')) return
    const notice = document.createElement('aside')
    notice.id = 'mela-pwa-update-notice'
    notice.setAttribute('role', 'status')
    notice.className = 'mela-pwa-update-notice'
    const heading = document.createElement('strong')
    heading.textContent = 'A newer MELA version is available.'
    const help = document.createElement('p')
    help.textContent = 'Save unfinished answers first. Update MELA without deleting your account, progress or preferences.'
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = 'Open latest MELA'
    button.onclick = () => {
      const destination = new URL(window.location.href)
      destination.searchParams.set('mela_refresh', String(Date.now()))
      window.location.replace(destination.toString())
    }
    const dismiss = document.createElement('button')
    dismiss.type = 'button'
    dismiss.textContent = 'Later'
    dismiss.onclick = () => notice.remove()
    notice.append(heading, help, button, dismiss)
    document.body.append(notice)
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) {
      updateAvailable = true
      if (document.visibilityState === 'visible') offerInstalledAppRefresh()
    }
    hadController = true
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') offerInstalledAppRefresh()
  })
  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL('sw.js', document.baseURI).toString()
    const scope = new URL('.', document.baseURI).pathname
    void navigator.serviceWorker.register(serviceWorkerUrl, {
      scope, updateViaCache: 'none',
    }).then(registration => registration.update()).catch(() => {})
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
