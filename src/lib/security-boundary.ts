export const LEGACY_ADMIN_STORAGE_KEY = 'mela-central-admin-auth'

type StorageBoundary = {
  removeItem: (key: string) => void
}

export function clearLegacyAdminSession(storage?: StorageBoundary) {
  try {
    const target = storage ?? window.localStorage
    target.removeItem(LEGACY_ADMIN_STORAGE_KEY)
  } catch {
    // Storage can be blocked or unavailable; cleanup must never stop app startup.
  }
}
