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
