import { describe, expect, it, vi } from 'vitest'
import { clearLegacyAdminSession, LEGACY_ADMIN_STORAGE_KEY } from '../src/lib/security-boundary'

describe('shared-origin admin credential cleanup', () => {
  it('removes the legacy central-admin storage key', () => {
    const removeItem = vi.fn()
    clearLegacyAdminSession({ removeItem })
    expect(removeItem).toHaveBeenCalledOnce()
    expect(removeItem).toHaveBeenCalledWith(LEGACY_ADMIN_STORAGE_KEY)
  })

  it('does not prevent app startup if browser storage is blocked', () => {
    expect(() => clearLegacyAdminSession({ removeItem: () => { throw new Error('blocked') } })).not.toThrow()
  })
})
