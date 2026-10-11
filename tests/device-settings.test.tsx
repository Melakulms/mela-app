import {afterEach, expect, it} from 'vitest'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import DeviceSettings from '../src/components/DeviceSettings'
import DraftCourseReader from '../src/components/DraftCourseReader'
afterEach(() => {cleanup(); localStorage.clear(); document.documentElement.className = ''})
it('applies and persists accessibility preferences and resets them without clearing accounts', () => {
  localStorage.setItem('unrelated-session','keep')
  render(<DeviceSettings />)
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
  render(<DeviceSettings />)
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
  render(<DeviceSettings />)
  expect(screen.getByRole('button', {name:'Check and refresh installed MELA'})).toBeTruthy()
  expect(screen.getByText(/not an APK/)).toBeTruthy()
  expect(screen.getByText(/does not install unreleased development features/)).toBeTruthy()
})

it('opens the published Settings panel from signed-in navigation', () => {
  const {container}=render(<DeviceSettings />)
  const panel=container.querySelector('details#mela-settings') as HTMLDetailsElement
  expect(panel.open).toBe(false)
  window.dispatchEvent(new Event('mela:open-settings'))
  expect(panel.open).toBe(true)
  expect(screen.getByText('MELA published version')).toBeTruthy()
})

it('labels only deployed features as published and explains why registration does not reopen for signed-in accounts', () => {
  render(<DeviceSettings />)
  expect(screen.getByText(/2026-10-11 · Settings, focus and reading controls/)).toBeTruthy()
  expect(screen.getByText(/Not published in this release/)).toBeTruthy()
  expect(screen.getByText(/MELA opens your existing account rather than showing registration again/)).toBeTruthy()
  expect(screen.getByRole('button',{name:'Check and refresh installed MELA'})).toBeTruthy()
})

it('applies real theme, high contrast and simpler visuals and persists them on this device', () => {
  const { unmount } = render(<DeviceSettings />)
  fireEvent.change(screen.getByLabelText('Color theme'), { target: {value:'light'} })
  fireEvent.click(screen.getByLabelText('High contrast'))
  fireEvent.click(screen.getByLabelText('Simpler visual effects'))
  expect(document.documentElement.dataset.melaTheme).toBe('light')
  expect(document.documentElement.classList.contains('mela-high-contrast')).toBe(true)
  expect(document.documentElement.classList.contains('mela-low-data')).toBe(true)
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).theme).toBe('light')
  unmount()
  render(<DeviceSettings />)
  expect((screen.getByLabelText('Color theme') as HTMLSelectElement).value).toBe('light')
  expect((screen.getByLabelText('High contrast') as HTMLInputElement).checked).toBe(true)
})

it('keeps a user-set learning target and retains other saved account data when resetting display', () => {
  localStorage.setItem('unrelated-session','keep')
  render(<DeviceSettings />)
  fireEvent.change(screen.getByLabelText('Daily study target (minutes on this device)'), {target:{value:'45'}})
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).dailyStudyMinutes).toBe(45)
  fireEvent.click(screen.getByRole('button',{name:'Reset display settings'}))
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).dailyStudyMinutes).toBe(45)
  fireEvent.click(screen.getByRole('button',{name:'Cancel reset'}))
  expect(localStorage.getItem('unrelated-session')).toBe('keep')
})

it('has a Settings center with substantive working sections and no fake notification toggles', () => {
  render(<DeviceSettings />)
  for (const name of ['Language','Appearance & accessibility','Learning preferences','Account, security & privacy','AI lessons & downloads','Installed app updates']) {
    expect(screen.getByRole('heading',{name})).toBeTruthy()
  }
  expect(screen.getByText(/Email, SMS and push reminders are not yet connected/)).toBeTruthy()
  expect(screen.queryByRole('checkbox',{name:/Enable push notifications/})).toBeNull()
})

it('changes MELA accent palette and comfortable reading spacing on the device', () => {
  render(<DeviceSettings />)
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
  const {unmount}=render(<DeviceSettings />)
  fireEvent.click(screen.getByRole('checkbox',{name:'Focus mode'}))
  expect(document.documentElement.classList.contains('mela-focus-mode')).toBe(true)
  expect(JSON.parse(localStorage.getItem('mela_device_preferences_v1')!).focusMode).toBe(true)
  unmount()
  render(<DeviceSettings />)
  expect((screen.getByRole('checkbox',{name:'Focus mode'}) as HTMLInputElement).checked).toBe(true)
  expect(localStorage.getItem('unrelated-session')).toBe('keep')
})

it('resets new reading, focus and accent options only after confirmation', () => {
  render(<DeviceSettings />)
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
