// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MentorshipPreparationStudio, { MENTORSHIP_SECTION_CARDS, PREPARATION_SECTIONS } from '../src/components/MentorshipPreparationStudio'

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('shows exactly 16 section cards immediately, with no collapsed panel or dropdown', () => {
  render(<MentorshipPreparationStudio />)
  expect(screen.getByRole('heading', { name: 'MELA Mentorship — 16 Sections' })).toBeTruthy()
  const sectionList = screen.getByLabelText('16 mentorship section cards')
  const buttons = Array.from(sectionList.querySelectorAll('button'))
  expect(buttons).toHaveLength(16)
  expect(MENTORSHIP_SECTION_CARDS).toHaveLength(16)
  expect(PREPARATION_SECTIONS).toHaveLength(16)
  expect(screen.queryByText('Explore the 16 mentorship preparation tools')).toBeNull()
  expect(screen.queryByLabelText('Choose an area to practise')).toBeNull()
  expect(sectionList.closest('details')).toBeNull()
  for (let i = 0; i < 16; i++) {
    const btn = screen.getByRole('button', { name: 'Open practice: ' + PREPARATION_SECTIONS[i] })
    expect(btn.getAttribute('aria-pressed')).toBe(i === 0 ? 'true' : 'false')
    expect(btn.textContent).toContain('Section ' + (i + 1))
  }
  expect(screen.getByLabelText('Practice tools for section 1')).toBeTruthy()
  expect(screen.getByText(/Live mentor matching, booking/)).toBeTruthy()
})

it('opens every visible card and shows the corresponding practice tool', () => {
  render(<MentorshipPreparationStudio />)
  for (let i = 1; i <= 16; i++) {
    const button = screen.getByRole('button', { name: 'Open practice: ' + PREPARATION_SECTIONS[i - 1] })
    fireEvent.click(button)
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Section ' + i + ': ' + PREPARATION_SECTIONS[i - 1] })).toBeTruthy()
    expect(screen.getByLabelText('Practice tools for section ' + i)).toBeTruthy()
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
  } finally {
    globalThis.fetch = priorFetch
  }
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

it('switching cards clears unsent practice text instead of leaking it to another section', () => {
  render(<MentorshipPreparationStudio />)
  fireEvent.change(screen.getByLabelText('My learning or career goal'), { target: { value: 'Sensitive private draft' } })
  fireEvent.click(screen.getByRole('button', { name: 'Open practice: Mentor Profiles' }))
  fireEvent.click(screen.getByRole('button', { name: 'Open practice: Mentorship Home' }))
  const subject = screen.getByLabelText('My learning or career goal') as HTMLInputElement
  expect(subject.value).toBe('')
})
