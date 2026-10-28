import { useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MentorshipSectionDirectory from '../src/components/MentorshipSectionDirectory'
afterEach(cleanup)
function Directory() {
  const [selected, onSelect] = useState<number|null>(null)
  return <><MentorshipSectionDirectory selected={selected} onSelect={onSelect}/><output aria-label="Selected tools">{selected}</output></>
}
describe('Mentorship section navigation', () => {
  it('opens each destination directly and returns to the directory', () => {
    render(<Directory />)
    const names = ['Mentorship Home','Find a Mentor','Mentorship Categories','Mentor Profiles',
      'Smart Matching','Mentorship Requests','Booking and Scheduling','Live Mentorship',
      'My Mentorship','Resources','Assignments','Progress','Group Mentorship',
      'Mentor Workspace','Guardian and Safety','Administration']
    for (const [index,name] of names.entries()) {
      fireEvent.click(screen.getByRole('button',{name:'Open '+name}))
      expect(screen.getByLabelText('Selected tools').textContent).toBe(String(index+1))
      expect(screen.getByRole('heading',{name:`${index+1}. ${name}`})).toBeTruthy()
      expect(screen.queryByRole('button',{name:/Go to .* tools/})).toBeNull()
      expect(screen.queryByRole('button',{name:'Open Resources'})).toBeNull()
      fireEvent.click(screen.getByRole('button',{name:'All mentorship sections'}))
      expect(screen.getAllByRole('button',{name:/^Open /})).toHaveLength(16)
    }
  })
  it('labels unavailable calls and restricted workspaces accurately', () => {
    render(<Directory />)
    fireEvent.click(screen.getByRole('button',{name:'Open Live Mentorship'}))
    expect(screen.getByText('Safety-gated — calls unavailable')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'All mentorship sections'}))
    fireEvent.click(screen.getByRole('button',{name:'Open Administration'}))
    expect(screen.getByText('Central Admin MFA required')).toBeTruthy()
  })
})
