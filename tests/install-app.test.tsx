import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import InstallApp from '../src/components/InstallApp'
import { I18nProvider } from '../src/i18n'

beforeEach(() => {
  localStorage.removeItem('mela_language')
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear() })
const mount = () => render(<I18nProvider><InstallApp /></I18nProvider>)
function offer(prompt = vi.fn(async () => {}), outcome = 'dismissed') {
  const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt, userChoice: Promise.resolve({ outcome }),
  })
  act(() => { window.dispatchEvent(event) })
  return { event, prompt }
}
it('offers manual help without claiming that the browser can prompt', () => {
  mount()
  expect(screen.queryByRole('button', { name: 'Install MELA' })).toBeNull()
  expect(screen.getByText(/Learning and account features need internet/)).toBeTruthy()
})
it('prompts only on a click and consumes a dismissed prompt once', async () => {
  mount(); const { event, prompt } = offer()
  expect(event.defaultPrevented).toBe(true)
  expect(prompt).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Install MELA' }))
  await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
  expect(prompt).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Add MELA to your phone')).toBeTruthy()
})
it('keeps manual help available after a browser prompt error', async () => {
  mount(); offer(vi.fn(async () => { throw new Error('not supported') }))
  fireEvent.click(screen.getByRole('button', { name: 'Install MELA' }))
  await waitFor(() => expect(screen.queryByRole('button')).toBeNull())
  expect(screen.getByText('Add MELA to your phone')).toBeTruthy()
})
it('hides installation controls after confirmed installation', () => {
  mount(); offer()
  act(() => { window.dispatchEvent(new Event('appinstalled')) })
  expect(screen.queryByRole('complementary')).toBeNull()
})
it('hides installation help when opened as an installed app', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
  mount(); expect(screen.queryByRole('complementary')).toBeNull()
})
it.each(['am', 'om', 'ti', 'so'])('uses the saved %s interface language', (language) => {
  localStorage.setItem('mela_language', language)
  mount(); expect(screen.queryByText('Add MELA to your phone')).toBeNull()
  expect(screen.getByRole('complementary').textContent).toContain('MELA')
})
