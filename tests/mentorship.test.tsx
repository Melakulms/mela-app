import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import Mentorship from '../src/pages/Mentorship'

const mocks = vi.hoisted(() => ({
  fetchVerifiedMentors: vi.fn(),
  fetchMyMentorshipRequests: vi.fn(),
  requestMentor: vi.fn(),
}))

vi.mock('../src/lib/mentorship', () => ({
  fetchVerifiedMentors: mocks.fetchVerifiedMentors,
  fetchMyMentorshipRequests: mocks.fetchMyMentorshipRequests,
  requestMentor: mocks.requestMentor,
}))

const mentor = {
  user_id: 'mentor-1',
  full_name: 'Mentor One',
  headline: 'Software engineer',
  bio: null,
  organization: null,
  years_experience: 5,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchVerifiedMentors.mockResolvedValue([mentor])
  mocks.fetchMyMentorshipRequests.mockResolvedValue([])
  mocks.requestMentor.mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('Mentorship', () => {
  it('surfaces load failures and retries without leaving a stale error', async () => {
    mocks.fetchVerifiedMentors.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<Mentorship onBack={vi.fn()} />)

    expect((await screen.findByRole('alert')).textContent).toContain('Network unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry mentorship' }))

    expect(await screen.findByText('Mentor One')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('validates the topic and serializes request submission', async () => {
    render(<Mentorship onBack={vi.fn()} />)
    await screen.findByText('Mentor One')

    fireEvent.click(screen.getByRole('button', { name: 'Request mentorship' }))
    const topic = screen.getByLabelText('Topic')
    const send = screen.getByRole('button', { name: 'Send request' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)

    fireEvent.change(topic, { target: { value: 'CV review' } })
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: 'Please review my CV.' } })
    fireEvent.click(send)
    fireEvent.click(send)

    await waitFor(() => expect(mocks.requestMentor).toHaveBeenCalledTimes(1))
    expect(mocks.requestMentor).toHaveBeenCalledWith('mentor-1', 'CV review', 'Please review my CV.')
    await waitFor(() => expect(mocks.fetchVerifiedMentors).toHaveBeenCalledTimes(2))
  })
})
