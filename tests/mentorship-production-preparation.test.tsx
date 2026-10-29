// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MentorshipPreparationStudio, { PREPARATION_SECTIONS } from '../src/components/MentorshipPreparationStudio'

beforeEach(() => { window.localStorage.clear() })
afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('offers all 16 preparation areas and labels them as non-live practice', () => {
  render(<MentorshipPreparationStudio />)
  fireEvent.click(screen.getByText('Explore the 16 mentorship preparation tools'))
  const select = screen.getByLabelText('Choose an area to practise') as HTMLSelectElement
  expect(select.options).toHaveLength(16)
  expect(PREPARATION_SECTIONS).toHaveLength(16)
  expect(screen.getByText(/not live mentor matching/)).toBeTruthy()
  for (let section = 1; section <= 16; section++) {
    fireEvent.change(select, { target: { value: String(section) } })
    expect(screen.getByRole('heading', { name: /Try it now:/ })).toBeTruthy()
    expect(screen.getByLabelText('Practice tools for section ' + section)).toBeTruthy()
  }
})

it('generates a worksheet only on explicit action with no account changes or persistence', () => {
  const storageSpy = vi.spyOn(Storage.prototype, 'setItem')
  const fetchSpy = vi.fn()
  const priorFetch = globalThis.fetch
  globalThis.fetch = fetchSpy as typeof fetch
  try {
    render(<MentorshipPreparationStudio />)
    fireEvent.click(screen.getByText('Explore the 16 mentorship preparation tools'))
    fireEvent.change(screen.getByLabelText('Choose an area to practise'), { target: { value: '6' } })
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

it('rejects a past preferred date instead of claiming a booking', () => {
  render(<MentorshipPreparationStudio />)
  fireEvent.click(screen.getByText('Explore the 16 mentorship preparation tools'))
  fireEvent.change(screen.getByLabelText('Choose an area to practise'), { target: { value: '7' } })
  fireEvent.change(screen.getByLabelText('Session topic'), { target: { value: 'Scholarship planning' } })
  fireEvent.change(screen.getByLabelText('What I will prepare beforehand'), { target: { value: 'Questions and documents list' } })
  fireEvent.change(screen.getByLabelText('Preferred date and time (optional, not booked)'), { target: { value: '2000-01-01T08:00' } })
  fireEvent.click(screen.getByRole('button', { name: 'Generate practice worksheet' }))
  expect(screen.getByRole('alert').textContent).toMatch(/Choose a future preferred date/)
  expect(screen.queryByLabelText('Worksheet text for copying')).toBeNull()
})
