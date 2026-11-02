// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import MentorshipPreparationStudio, { MENTORSHIP_SECTION_CARDS, PREPARATION_SECTIONS } from '../src/components/MentorshipPreparationStudio'

beforeEach(() => { window.history.replaceState(null, '', '/mela-app/?view=mentorship'); window.localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/mela-app/') })

it('shows all 16 section cards on the index, without repeating a practice panel', () => {
  render(<MentorshipPreparationStudio />)
  expect(screen.getByRole('heading', { name: 'MELA Mentorship — 16 Sections' })).toBeTruthy()
  const sectionList = screen.getByLabelText('16 mentorship section cards')
  expect(sectionList.querySelectorAll('button')).toHaveLength(16)
  expect(MENTORSHIP_SECTION_CARDS).toHaveLength(16)
  expect(PREPARATION_SECTIONS).toHaveLength(16)
  expect(screen.queryByLabelText('Practice tools for section 1')).toBeNull()
  for (const name of PREPARATION_SECTIONS) expect(screen.getByRole('button', { name: 'Open practice: ' + name })).toBeTruthy()
})

it('opens each card in a focused screen and returns to the index with browser Back', () => {
  render(<MentorshipPreparationStudio />)
  for (let i = 1; i <= 16; i++) {
    fireEvent.click(screen.getByRole('button', { name: 'Open practice: ' + PREPARATION_SECTIONS[i - 1] }))
    expect(window.location.search).toContain('section=' + i)
    expect(screen.queryByLabelText('16 mentorship section cards')).toBeNull()
    expect(screen.getByRole('heading', { name: PREPARATION_SECTIONS[i - 1] })).toBeTruthy()
    expect(screen.getByLabelText('Practice tools for section ' + i)).toBeTruthy()
    act(() => { window.history.replaceState(null, '', '/mela-app/?view=mentorship'); window.dispatchEvent(new PopStateEvent('popstate')) })
    expect(screen.getByLabelText('16 mentorship section cards')).toBeTruthy()
    expect(screen.queryByLabelText('Practice tools for section ' + i)).toBeNull()
  }
})

it('generates local worksheet with no network calls or persisted account updates', () => {
  const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
  const fetchSpy = vi.fn()
  const priorFetch = globalThis.fetch
  globalThis.fetch = fetchSpy as typeof fetch
  try {
    render(<MentorshipPreparationStudio />)
    fireEvent.click(screen.getByRole('button', { name: 'Open practice: Mentorship Requests' }))
    fireEvent.change(screen.getByLabelText('Request topic'), { target: { value: 'Career exploration' } })
    fireEvent.change(screen.getByLabelText('Specific help I will ask for'), { target: { value: 'Prepare three questions' } })
    fireEvent.click(screen.getByRole('button', { name: 'Generate practice worksheet' }))
    const result = screen.getByLabelText('Worksheet text for copying') as HTMLTextAreaElement
    expect(result.value).toContain('PRACTICE ONLY')
    expect(result.value).toContain('Career exploration')
    expect(result.value).toContain('not saved to MELA')
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(storageSpy).not.toHaveBeenCalled()
  } finally { globalThis.fetch = priorFetch }
})

it('rejects a past preferred date instead of claiming a real booking', () => {
  render(<MentorshipPreparationStudio />)
  fireEvent.click(screen.getByRole('button', { name: 'Open practice: Booking & Scheduling' }))
  fireEvent.change(screen.getByLabelText('Session topic'), { target: { value: 'Scholarship planning' } })
  fireEvent.change(screen.getByLabelText('What I will prepare beforehand'), { target: { value: 'Questions and documents list' } })
  fireEvent.change(screen.getByLabelText('Preferred date and time (optional, not booked)'), { target: { value: '2000-01-01T08:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate practice worksheet' }))
  expect(screen.getByRole('alert').textContent).toMatch(/Choose a future preferred date/)
  expect(screen.queryByLabelText('Worksheet text for copying')).toBeNull()
})

it('switching away and returning clears unsent practice text', () => {
  render(<MentorshipPreparationStudio />)
  fireEvent.click(screen.getByRole('button', { name: 'Open practice: Mentorship Home' }))
  fireEvent.change(screen.getByLabelText('My learning or career goal'), { target: { value: 'Unsaved draft' } })
  act(() => { window.history.replaceState(null, '', '/mela-app/?view=mentorship'); window.dispatchEvent(new PopStateEvent('popstate')) })
  fireEvent.click(screen.getByRole('button', { name: 'Open practice: Mentorship Home' }))
  expect((screen.getByLabelText('My learning or career goal') as HTMLInputElement).value).toBe('')
})
