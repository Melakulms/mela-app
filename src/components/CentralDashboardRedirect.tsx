import { useEffect } from 'react'

export const CENTRAL_DASHBOARD_URL = 'https://melakulms.github.io/Mela-central-dashboard-/'

export default function CentralDashboardRedirect() {
  useEffect(() => {
    // Replace the main-app history entry so Back does not repeat the redirect.
    window.location.replace(CENTRAL_DASHBOARD_URL)
  }, [])

  return <div className="centered-loading" role="status">
    <a href={CENTRAL_DASHBOARD_URL}>Continue to Central Dashboard</a>
  </div>
}
