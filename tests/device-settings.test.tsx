import {afterEach, expect, it, vi} from 'vitest'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import DeviceSettings from '../src/components/DeviceSettings'
import DraftCourseReader from '../src/components/DraftCourseReader'
function renderSettings(open = true) {
  const result = render(<DeviceSettings />)
  if (open) act(() => { window.dispatchEvent(new Event('mela:open-settings')) })
  return result
}
afterEach(() => {cleanup(); localStorage.clear(); document.documentElement.className = ''})
it('applies and persists accessibility preferences and resets them without clearing accounts', () => {
  localStorage.setItem('unrelated-session','keep')
  renderSettings()
  fireEvent.click(screen.getByLabelText('Larger text'))
  expect(document.documentElement.classList.contains('mela-large-text')).toBe(true)
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).largeText).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'Reset display settings'}))
  expect(document.documentElement.classList.contains('mela-large-text')).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'Confirm reset display settings'}))
  expect(document.documentElement.classList.contains('mela-large-text')).toBe(false)
  expect(localStorage.getItem('unrelated-session')).toBe('keep')
})
it('provides a real lesson download distinct from app installation', () => {
  renderSettings()
  expect(screen.getByRole('link',{name:'Download lesson handbook'}).getAttribute('download')).toBe('MELA-AI-Year-One.html')
})
it('reads the first and last weekly lessons without a database or completion claim', () => {
  render(<DraftCourseReader onBack={() => {}} />)
  expect(screen.getByRole('heading',{name:'What AI can and cannot do'})).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Choose a week'),{target:{value:'51'}})
  expect(screen.getByRole('status').textContent).toContain('Week 52 of 52')
  expect((screen.getByRole('button',{name:'Next week'}) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('button',{name:'Mark lesson complete'})).toBeNull()
})

it('shows a clear update control without falsely promising to deploy development changes', () => {
  renderSettings()
  expect(screen.getByRole('button', {name:'Check and refresh installed MELA'})).toBeTruthy()
  expect(screen.getByText(/not an APK/)).toBeTruthy()
  expect(screen.getByText(/does not install unreleased development features/)).toBeTruthy()
})

it('opens the published Settings panel from signed-in navigation', () => {
  const {container}=renderSettings(false)
  const panel=container.querySelector('#mela-settings-content') as HTMLElement
  expect(panel.hidden).toBe(true)
  act(() => { window.dispatchEvent(new Event('mela:open-settings')) })
  expect(panel.hidden).toBe(false)
  expect(screen.getByText('MELA release')).toBeTruthy()
})

it('labels only deployed features as published and explains why registration does not reopen for signed-in accounts', () => {
  renderSettings()
  expect(screen.getByText(/Release not verified on this device/)).toBeTruthy()
  expect(screen.getByText(/Not published in this release/)).toBeTruthy()
  expect(screen.getByText(/MELA opens your existing account rather than showing registration again/)).toBeTruthy()
  expect(screen.getByRole('button',{name:'Check and refresh installed MELA'})).toBeTruthy()
})

it('applies real theme, high contrast and simpler visuals and persists them on this device', () => {
  const { unmount } = renderSettings()
  fireEvent.change(screen.getByLabelText('Color theme'), { target: {value:'light'} })
  fireEvent.click(screen.getByLabelText('High contrast'))
  fireEvent.click(screen.getByLabelText('Simpler visual effects'))
  expect(document.documentElement.dataset.melaTheme).toBe('light')
  expect(document.documentElement.classList.contains('mela-high-contrast')).toBe(true)
  expect(document.documentElement.classList.contains('mela-low-data')).toBe(true)
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).theme).toBe('light')
  unmount()
  renderSettings()
  expect((screen.getByLabelText('Color theme') as HTMLSelectElement).value).toBe('light')
  expect((screen.getByLabelText('High contrast') as HTMLInputElement).checked).toBe(true)
})

it('keeps a user-set learning target and retains other saved account data when resetting display', () => {
  localStorage.setItem('unrelated-session','keep')
  renderSettings()
  fireEvent.change(screen.getByLabelText('Daily study target (minutes on this device)'), {target:{value:'45'}})
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).dailyStudyMinutes).toBe(45)
  fireEvent.click(screen.getByRole('button',{name:'Reset display settings'}))
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).dailyStudyMinutes).toBe(45)
  fireEvent.click(screen.getByRole('button',{name:'Cancel reset'}))
  expect(localStorage.getItem('unrelated-session')).toBe('keep')
})

it('has a Settings center with substantive working sections and no fake notification toggles', () => {
  renderSettings()
  for (const name of ['Language','Appearance & accessibility','Learning preferences','Account, security & privacy','AI lessons & downloads','Installed app updates']) {
    expect(screen.getByRole('heading',{name})).toBeTruthy()
  }
  expect(screen.getByText(/Email, SMS and push reminders are not yet connected/)).toBeTruthy()
  expect(screen.queryByRole('checkbox',{name:/Enable push notifications/})).toBeNull()
})

it('changes MELA accent palette and comfortable reading spacing on the device', () => {
  renderSettings()
  fireEvent.change(screen.getByLabelText('Accent color'),{target:{value:'violet'}})
  fireEvent.change(screen.getByLabelText('Reading spacing'),{target:{value:'relaxed'}})
  expect(document.documentElement.dataset.melaAccent).toBe('violet')
  expect(document.documentElement.dataset.melaReading).toBe('relaxed')
  const stored=JSON.parse(localStorage.getItem('mela_device_preferences_v1')!)
  expect(stored.accent).toBe('violet')
  expect(stored.readingSpacing).toBe('relaxed')
})

it('enables and persists Focus mode without removing study progress or account information', () => {
  localStorage.setItem('unrelated-session','keep')
  const {unmount}=renderSettings()
  fireEvent.click(screen.getByRole('checkbox',{name:'Focus mode'}))
  expect(document.documentElement.classList.contains('mela-focus-mode')).toBe(true)
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).focusMode).toBe(true)
  unmount()
  renderSettings()
  expect((screen.getByRole('checkbox',{name:'Focus mode'}) as HTMLInputElement).checked).toBe(true)
  expect(localStorage.getItem('unrelated-session')).toBe('keep')
})

it('resets new reading, focus and accent options only after confirmation', () => {
  renderSettings()
  fireEvent.change(screen.getByLabelText('Accent color'),{target:{value:'coral'}})
  fireEvent.change(screen.getByLabelText('Reading spacing'),{target:{value:'compact'}})
  fireEvent.click(screen.getByRole('checkbox',{name:'Focus mode'}))
  fireEvent.click(screen.getByRole('button',{name:'Reset display settings'}))
  expect(document.documentElement.dataset.melaAccent).toBe('coral')
  fireEvent.click(screen.getByRole('button',{name:'Confirm reset display settings'}))
  expect(document.documentElement.dataset.melaAccent).toBe('gold')
  expect(document.documentElement.dataset.melaReading).toBe('standard')
  expect(document.documentElement.classList.contains('mela-focus-mode')).toBe(false)
})

it('returns from Settings to MELA home, clears the settings anchor and closes the panel', () => {
  const home = vi.fn()
  window.addEventListener('mela:go-home', home)
  const {container}=renderSettings()
  const panel=container.querySelector('#mela-settings-content') as HTMLElement
  act(() => { window.dispatchEvent(new Event('mela:open-settings')) })
  expect(panel.hidden).toBe(false)
  window.history.replaceState(null, '', '/mela-app/#settings-learning')
  fireEvent.click(screen.getAllByRole('link',{name:'Back to MELA Home'})[0])
  expect(panel.hidden).toBe(true)
  expect(window.location.hash).toBe('')
  expect(home).toHaveBeenCalledOnce()
  expect(new URLSearchParams(window.location.search).get('view')).toBe('dashboard')
  window.removeEventListener('mela:go-home', home)
  window.history.replaceState(null, '', '/')
})

it('supports Escape from Settings without signing the user out', () => {
  const {container}=renderSettings()
  const panel=container.querySelector('#mela-settings-content') as HTMLElement
  act(() => { window.dispatchEvent(new Event('mela:open-settings')) })
  fireEvent.keyDown(document,{key:'Escape'})
  expect(panel.hidden).toBe(true)
})

it('changes Settings sections without adding Android Back history entries', () => {
  renderSettings()
  const before = window.location.href
  fireEvent.click(screen.getByRole('button',{name:'Learning'}))
  expect(window.location.href).toBe(before)
  expect(window.location.hash.startsWith('#settings-')).toBe(false)
})

it('closes Settings when Android Back restores the prior history entry', () => {
  const {container}=renderSettings()
  const panel=container.querySelector('#mela-settings-content') as HTMLElement
  act(() => { window.dispatchEvent(new Event('mela:open-settings')) })
  expect(panel.hidden).toBe(false)
  expect(window.history.state?.melaSettingsOpen).toBe(true)
  window.history.replaceState(null, '', '/mela-app/')
  fireEvent.popState(window, {state:null})
  expect(panel.hidden).toBe(true)
  window.history.replaceState(null, '', '/')
})

it('returns to the dashboard even without a mounted student router listener', () => {
  window.history.replaceState(null, '', '/mela-app/?view=practice&mela_refresh=old#settings-updates')
  const {container}=renderSettings()
  const panel=container.querySelector('#mela-settings-content') as HTMLElement
  act(() => { window.dispatchEvent(new Event('mela:open-settings')) })
  fireEvent.click(screen.getAllByRole('link',{name:'Back to MELA Home'})[0])
  expect(panel.hidden).toBe(true)
  expect(new URLSearchParams(window.location.search).get('view')).toBe('dashboard')
  expect(new URLSearchParams(window.location.search).get('mela_refresh')).toBeNull()
  expect(window.location.hash).toBe('')
  window.history.replaceState(null,'','/')
})

it('has a real Home destination and removes Settings controls after Home', () => {
  renderSettings()
  const link = screen.getAllByRole('link', {name:'Back to MELA Home'})[0]
  expect(link.getAttribute('href')).toMatch(/\?view=dashboard$/)
  fireEvent.click(link)
  expect(screen.queryByRole('heading', {name:'Settings'})).toBeNull()
  expect(screen.getByRole('button', {name:'Settings & downloads — app version'}).getAttribute('aria-expanded')).toBe('false')
})
