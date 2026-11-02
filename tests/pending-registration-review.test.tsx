import {describe, expect, it, vi} from 'vitest'
import {render, screen, fireEvent} from '@testing-library/react'
import PendingRegistrationReview from '../src/pages/PendingRegistrationReview'

describe('verified credentials with pending MELA account status', () => {
  it('shows a status review instead of looping through email confirmation', () => {
    const onRefresh = vi.fn()
    const onSignOut = vi.fn()
    render(<PendingRegistrationReview role="student" onRefresh={onRefresh} onSignOut={onSignOut} />)
    expect(screen.getByRole('heading', {name:'Sign-in verified — account review pending'})).toBeTruthy()
    expect(screen.getByText(/do not need to request another confirmation email/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name:'Check account status'}))
    fireEvent.click(screen.getByRole('button', {name:'Sign out'}))
    expect(onRefresh).toHaveBeenCalledTimes(1)
    expect(onSignOut).toHaveBeenCalledTimes(1)
  })
  it('keeps professional approval separate from contact verification', () => {
    render(<PendingRegistrationReview role="mentor" onRefresh={vi.fn()} onSignOut={vi.fn()} />)
    expect(screen.getByText(/does not automatically approve qualifications/i)).toBeTruthy()
  })
})
