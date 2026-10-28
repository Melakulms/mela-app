import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MentorshipSectionDirectory from '../src/components/MentorshipSectionDirectory'

afterEach(() => {
  cleanup()
  document.querySelector('#mentorship-goals')?.remove()
  vi.restoreAllMocks()
})

describe('Mentorship 16-section navigation', () => {
  it('opens all 16 sections without blank anchor-only cards', () => {
    render(<MentorshipSectionDirectory />)
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(16)
    for (const name of [
      'Mentorship Home','Find a Mentor','Mentorship Categories','Mentor Profiles',
      'Smart Matching','Mentorship Requests','Booking and Scheduling','Live Mentorship',
      'My Mentorship','Resources','Assignments','Progress','Group Mentorship',
      'Mentor Workspace','Guardian and Safety','Administration',
    ]) {
      fireEvent.click(screen.getByRole('button', { name: 'Open '+name }))
      const panel = document.getElementById('mentorship-section-detail')
      expect(panel?.textContent).toContain(name)
      expect(panel?.textContent?.length).toBeGreaterThan(75)
      expect(screen.getByRole('button', { name: 'Close section' })).toBeTruthy()
    }
  })

  it('shows restrictions without presenting dangerous actions as enabled', () => {
    render(<MentorshipSectionDirectory />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Mentor Workspace' }))
    const panel=document.getElementById('mentorship-section-detail')!
    expect(panel.textContent).toContain('Verified mentor account required')
    expect(panel.querySelector('button.btn-primary')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open Administration' }))
    expect(panel.textContent).toContain('Central Admin MFA required')
    expect(panel.querySelector('button.btn-primary')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Open Live Mentorship' }))
    expect(panel.textContent).toContain('calls unavailable')
    expect(panel.textContent).toContain('not activated')
  })

  it('reports absent backend-mounted tools instead of navigating to a missing anchor', () => {
    render(<MentorshipSectionDirectory />)
    fireEvent.click(screen.getByRole('button', { name: 'Open Resources' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to Resources tools' }))
    expect(screen.getByText(/tools for this section are not loaded/)).toBeTruthy()
  })

  it('opens an existing tool section and closes it on demand', () => {
    const scroll=vi.fn()
    const element=document.createElement('section')
    element.id='mentorship-goals'
    element.scrollIntoView=scroll
    document.body.append(element)
    render(<MentorshipSectionDirectory />)
    fireEvent.click(screen.getByRole('button', { name: 'Open My Mentorship' }))
    fireEvent.click(screen.getByRole('button', { name: 'Go to My Mentorship tools' }))
    expect(scroll).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Close section' }))
    expect(document.getElementById('mentorship-section-detail')).toBeNull()
  })
})
