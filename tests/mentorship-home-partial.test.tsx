import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import MentorshipHome from '../src/components/MentorshipHome'

afterEach(cleanup)

it('does not present unavailable private mentorship data as confirmed zero counts', () => {
  render(<MentorshipHome
    mentors={[]} requests={[]} sessions={[]} stageKey="school_11_12"
    requestsAvailable={false} sessionsAvailable={false} revision={0} />)
  expect(screen.getByText(/Unavailable counters are labeled/)).toBeTruthy()
  expect(screen.getAllByText('Unavailable')).toHaveLength(3)
  expect(screen.getByText(/Session history is temporarily unavailable/)).toBeTruthy()
  expect(screen.queryByText(/No upcoming confirmed sessions/)).toBeNull()
})

it('shows meaningful zero counts when all real endpoints succeeded', () => {
  render(<MentorshipHome mentors={[]} requests={[]} sessions={[]} revision={0} />)
  expect(screen.queryByText(/Unavailable counters are labeled/)).toBeNull()
  expect(screen.getByText(/No upcoming confirmed sessions/)).toBeTruthy()
})
