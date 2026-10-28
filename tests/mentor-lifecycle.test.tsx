import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorLifecycle from '../src/components/MentorLifecycle'

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), complete: vi.fn(), schedule: vi.fn(), cancel: vi.fn() }))
vi.mock('../src/components/MentorAvailabilityManager', () => ({ default: () => null }))
vi.mock('../src/lib/supabase', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser }, rpc: mocks.rpc } }))
vi.mock('../src/lib/mentorship', () => ({ completeMentorshipSession: mocks.complete, scheduleMentorshipSession: mocks.schedule, cancelMentorshipSession: mocks.cancel }))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'mentor' } }, error: null })
  mocks.complete.mockResolvedValue(undefined)
  mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ error: null, data: table === 'mentorship_requests'
    ? [{ id: 'request', mentee_id: 'learner', topic: 'Career planning', message: 'Help me choose a field.', preferred_at: null, status: 'accepted', created_at: '2020-01-01' }]
    : [{ id: 'session', request_id: 'request', mentor_id: 'mentor', mentee_id: 'learner', scheduled_at: '2020-01-01T10:00:00Z', duration_min: 30, status: 'scheduled' }] }) }) }) }))
})
afterEach(cleanup)
it('shows the learner request and saves shared follow-up notes on completion', async () => {
  const changed = vi.fn()
  render(<MentorLifecycle onChanged={changed} />)
  await screen.findByText('Help me choose a field.')
  fireEvent.change(screen.getByLabelText('Follow-up notes for the learner (optional)'), { target: { value: 'Compare two training paths.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
  await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith('session', 'Compare two training paths.'))
  expect(changed).toHaveBeenCalledTimes(1)
})
it('retains follow-up notes when completion fails', async () => {
  mocks.complete.mockRejectedValueOnce(new Error('Connection failed'))
  render(<MentorLifecycle onChanged={vi.fn()} />)
  await screen.findByText('Help me choose a field.')
  fireEvent.change(screen.getByLabelText('Follow-up notes for the learner (optional)'), { target: { value: 'Keep this feedback.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Mark complete' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Connection failed')
  expect((screen.getByLabelText('Follow-up notes for the learner (optional)') as HTMLTextAreaElement).value).toBe('Keep this feedback.')
})

function loadSessions(sessions: object[]) {
  mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ error: null, data: table === 'mentorship_requests'
    ? [{ id: 'request', mentee_id: 'learner', topic: 'Career planning', message: 'Help me choose a field.', status: 'accepted', created_at: '2020-01-01' }]
    : sessions }) }) }) }))
}
it('does not allow completion until the entire booked duration has passed', async () => {
  loadSessions([{id:'session',request_id:'request',scheduled_at:new Date(Date.now()-5*60_000).toISOString(),duration_min:30,status:'scheduled'}])
  render(<MentorLifecycle onChanged={vi.fn()} />)
  await screen.findByText('Help me choose a field.')
  expect((screen.getByRole('button',{name:'Mark complete'}) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'Mark complete'}))
  expect(mocks.complete).not.toHaveBeenCalled()
})
it('keeps the new booking visible when an older cancelled appointment exists', async () => {
  loadSessions([
    {id:'current',request_id:'request',scheduled_at:'2099-01-01T10:00:00Z',duration_min:30,status:'scheduled',notes:'Current booking'},
    {id:'old',request_id:'request',scheduled_at:'2020-01-01T10:00:00Z',duration_min:30,status:'cancelled',notes:'Old cancellation'},
  ])
  render(<MentorLifecycle onChanged={vi.fn()} />)
  await screen.findByText('Help me choose a field.')
  expect(screen.queryByRole('button',{name:'Schedule session'})).toBeNull()
  expect(screen.getByText(/Current booking/)).toBeTruthy()
  expect(screen.queryByText(/Old cancellation/)).toBeNull()
  expect(screen.getByRole('button',{name:'Add to my calendar'})).toBeTruthy()
})
it('hides private request details after a refresh loses access', async () => {
  render(<MentorLifecycle onChanged={vi.fn()} />)
  await screen.findByText('Help me choose a field.')
  mocks.getUser.mockResolvedValueOnce({data:{user:null},error:null})
  fireEvent.click(screen.getByRole('button',{name:'Refresh'}))
  await screen.findByRole('alert')
  expect(screen.queryByText('Help me choose a field.')).toBeNull()
  expect(screen.queryByRole('button',{name:'Mark complete'})).toBeNull()
})

it('keeps verified mentor requests visible when session history fails, without enabling a duplicate booking', async () => {
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve(table === 'mentorship_sessions'
          ? { data:null, error: new Error('Calendar API unavailable') }
          : { data:[{id:'request',mentee_id:'learner',topic:'Career planning',message:'Help me choose a field.',status:'accepted',created_at:'2020-01-01'}],error:null }),
      }),
    }),
  }))
  render(<MentorLifecycle onChanged={vi.fn()} />)
  expect(await screen.findByText('Help me choose a field.')).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('Calendar API unavailable')
  expect(screen.queryByRole('button', { name: 'Schedule session' })).toBeNull()
  expect(mocks.schedule).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  await waitFor(() => expect(mocks.from.mock.calls.filter(([name])=>name==='mentorship_sessions').length).toBe(2))
})

it('never presents failed request-history reads as a genuinely empty mentor inbox', async () => {
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: () => ({
        order: () => Promise.resolve(table === 'mentorship_requests'
          ? { data:null, error: new Error('Request API unavailable') }
          : { data:[], error:null }),
      }),
    }),
  }))
  render(<MentorLifecycle onChanged={vi.fn()} />)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('Request API unavailable'))
  expect(screen.getByText(/not a confirmed empty inbox/)).toBeTruthy()
  expect(screen.queryByText('No mentorship requests.')).toBeNull()
  expect(screen.queryByRole('button',{name:'Schedule session'})).toBeNull()
})
