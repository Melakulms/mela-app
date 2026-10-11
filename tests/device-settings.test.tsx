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
  expect(screen.getByText(/2026-10-11 · Settings and update navigation/)).toBeTruthy()
  expect(screen.getByText(/Not published in this release/)).toBeTruthy()
  expect(screen.getByText(/MELA opens your existing account rather than showing registration again/)).toBeTruthy()
  expect(screen.getByRole('button',{name:'Check and refresh installed MELA'})).toBeTruthy()
})
