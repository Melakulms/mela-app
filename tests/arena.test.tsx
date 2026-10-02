import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LiveMatch } from '../src/pages/Arena'

const mocks = vi.hoisted(() => ({
  fetchMatchState: vi.fn(), fetchMatchContext: vi.fn(), fetchScoreboard: vi.fn(),
  fetchCurrentRoundDetail: vi.fn(), fetchMyRoundResult: vi.fn(), readyForMatch: vi.fn(),
  startMatch: vi.fn(), submitRound: vi.fn(), fetchLeaderboard: vi.fn(), joinMatchmaking: vi.fn(),
  cancelMatchmaking: vi.fn(), checkMyQueueStatus: vi.fn(),
}))
vi.mock('../src/lib/arena', () => mocks)
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchMatchState.mockResolvedValue({ id: 'match', title: 'Quiz battle', status: 'open', participant_count: 2, current_round: null })
  mocks.fetchMatchContext.mockResolvedValue({ userId: 'one', isCreator: true })
  mocks.fetchScoreboard.mockResolvedValue([])
  mocks.fetchMyRoundResult.mockResolvedValue(null)
  mocks.readyForMatch.mockResolvedValue(undefined)
})
afterEach(cleanup)
const show = () => render(<LiveMatch matchId="match" onLeave={vi.fn()} onBack={vi.fn()} />)

it('shows an error and recovers from a failed match load', async () => {
  mocks.fetchMatchState.mockRejectedValueOnce(new Error('Connection interrupted'))
  show()
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByRole('heading', { name: 'Quiz battle' })
})

it('offers ready controls and prevents starting until both players are ready', async () => {
  show()
  const start = await screen.findByRole('button', { name: 'Start match' })
  expect((start as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: "I'm ready" }))
  await waitFor(() => expect(mocks.readyForMatch).toHaveBeenCalledWith('match'))
})

it('does not offer the creator start action to the other player', async () => {
  mocks.fetchMatchContext.mockResolvedValue({ userId: 'two', isCreator: false })
  show()
  await screen.findByRole('button', { name: "I'm ready" })
  expect(screen.queryByRole('button', { name: 'Start match' })).toBeNull()
})

it('submits the choice ID and displays the score returned by the server', async () => {
  mocks.fetchMatchState.mockResolvedValue({ id: 'match', title: 'Quiz battle', status: 'live', participant_count: 2, current_round: { round_order: 1, state: 'open' } })
  mocks.fetchCurrentRoundDetail.mockResolvedValue({ id: 'round', prompt: 'Choose an answer', max_points: 10, config: { choices: [{ id: 'A', text: 'First choice' }] } })
  mocks.submitRound.mockResolvedValue({ score: 10, feedback: null })
  show()
  fireEvent.click(await screen.findByRole('button', { name: 'First choice' }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit answer' }))
  await screen.findByText(/Score: 10 \/ 10/)
  expect(mocks.submitRound).toHaveBeenCalledExactlyOnceWith('round', 'A')
  expect(screen.queryByRole('button', { name: 'Submit answer' })).toBeNull()
})

it('restores an existing submission after reopening a match', async () => {
  mocks.fetchMatchState.mockResolvedValue({ id: 'match', title: 'Quiz battle', status: 'live', participant_count: 2, current_round: { round_order: 1, state: 'open' } })
  mocks.fetchCurrentRoundDetail.mockResolvedValue({ id: 'round', prompt: 'Choose an answer', max_points: 10, config: {} })
  mocks.fetchMyRoundResult.mockResolvedValue({ score: 0, feedback: null })
  show()
  await screen.findByText(/Score: 0 \/ 10/)
  expect(screen.queryByRole('button', { name: 'Submit answer' })).toBeNull()
})
