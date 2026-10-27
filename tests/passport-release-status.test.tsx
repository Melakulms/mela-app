import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import PassportReleaseStatus from '../src/components/PassportReleaseStatus'

const running = 'a'.repeat(40)
const newer = 'b'.repeat(40)
beforeEach(() => {
  vi.stubEnv('VITE_MELA_BUILD_SHA', running)
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})
it('shows the production protections and build currently running on the phone', () => {
  render(<PassportReleaseStatus />)
  expect(screen.getByText(/records cannot be edited or deleted while a review is pending/i)).toBeTruthy()
  expect(screen.getByText('aaaaaaaa')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Check latest MELA version' })).toBeTruthy()
  expect(fetch).not.toHaveBeenCalled()
})
it('checks the uncached release marker and reports the current build', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ commit: running }) } as Response)
  render(<PassportReleaseStatus />)
  fireEvent.click(screen.getByRole('button', { name: 'Check latest MELA version' }))
  expect(await screen.findByText('This phone is running the latest published MELA version.')).toBeTruthy()
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('mela-release.json?check='), { cache: 'no-store' })
})
it('explains an outdated installed Android build without erasing storage', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ commit: newer }) } as Response)
  render(<PassportReleaseStatus />)
  fireEvent.click(screen.getByRole('button', { name: 'Check latest MELA version' }))
  expect(await screen.findByText(/A newer version/)).toBeTruthy()
  expect(screen.getByText('bbbbbbbb')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Reload latest MELA' })).toBeTruthy()
})
it('fails safely when the release file is missing or not a full commit', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ commit: 'bad' }) } as Response)
  render(<PassportReleaseStatus />)
  fireEvent.click(screen.getByRole('button', { name: 'Check latest MELA version' }))
  expect(await screen.findByText(/latest version could not be checked/i)).toBeTruthy()
})
