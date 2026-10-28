import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorLifecycle from '../src/components/MentorLifecycle'

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), rpc: vi.fn(), complete: vi.fn(), schedule: vi.fn(), cancel: vi.fn(), respond: vi.fn() }))
vi.mock('../src/components/MentorAvailabilityManager', () => ({ default: () => null }))
vi.mock('../src/lib/supabase', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser }, rpc: mocks.rpc } }))
vi.mock('../src/lib/mentorship', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/mentorship')>()),
  completeMentorshipSession: mocks.complete, scheduleMentorshipSession: mocks.schedule, cancelMentorshipSession: mocks.cancel, respondToMentorshipRequest: mocks.respond,
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'mentor' } }, error: null })
  mocks.complete.mockResolvedValue(undefined)
  mocks.respond.mockResolvedValue(undefined)
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


it('blocks past or invalid mentor bookings before calling the backend, then submits a valid future time', async()=>{
  loadSessions([])
  mocks.schedule.mockResolvedValue(undefined)
  render(<MentorLifecycle onChanged={vi.fn()} />)
  await screen.findByText('Help me choose a field.')
  fireEvent.click(screen.getByRole('button',{name:'Schedule session'}))
  const input=screen.getByLabelText('Session time') as HTMLInputElement
  fireEvent.change(input,{target:{value:'2020-01-01T10:00'}})
  expect((screen.getByRole('button',{name:'Save session'}) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText(/Select a future appointment time/)).toBeTruthy()
  expect(mocks.schedule).not.toHaveBeenCalled()
  fireEvent.change(input,{target:{value:'2099-01-01T10:00'}})
  expect((screen.getByRole('button',{name:'Save session'}) as HTMLButtonElement).disabled).toBe(false)
  fireEvent.click(screen.getByRole('button',{name:'Save session'}))
  await waitFor(()=>expect(mocks.schedule).toHaveBeenCalledWith('request','2099-01-01T10:00',30))
})

function pendingRequest() {
  mocks.from.mockImplementation((table: string) => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ error: null, data: table === 'mentorship_requests'
    ? [{ id: 'pending-request', mentee_id: 'learner', topic: 'Interview practice', message: 'Need help.', preferred_at: null, status: 'pending', created_at: '2020-01-01' }]
    : [] }) }) }) }))
}
it('requires a reason before a request can be declined', async () => {
  pendingRequest()
  render(<MentorLifecycle onChanged={vi.fn()} />)
  await screen.findByText('Interview practice')
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  const confirm = screen.getByRole('button', { name: 'Confirm decline' }) as HTMLButtonElement
  expect(confirm.disabled).toBe(true)
  expect(mocks.respond).not.toHaveBeenCalled()
})
it('sends a validated reason and optional note through the server decline action', async () => {
  pendingRequest()
  const changed = vi.fn()
  render(<MentorLifecycle onChanged={changed} />)
  await screen.findByText('Interview practice')
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  fireEvent.change(screen.getByLabelText('Reason for declining (required)'), { target: { value: 'capacity_full' } })
  fireEvent.change(screen.getByLabelText('Short note for the learner (optional)'), { target: { value: '  I can help again next month.  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Confirm decline' }))
  await waitFor(() => expect(mocks.respond).toHaveBeenCalledWith('pending-request', 'declined', 'capacity_full', 'I can help again next month.'))
  expect(changed).toHaveBeenCalledTimes(1)
})
it('keeps the request open when the mentor backs out of the decline form', async () => {
  pendingRequest()
  render(<MentorLifecycle onChanged={vi.fn()} />)
  await screen.findByText('Interview practice')
  fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep request' }))
  expect(screen.queryByRole('button', { name: 'Confirm decline' })).toBeNull()
  expect(mocks.respond).not.toHaveBeenCalled()
})
