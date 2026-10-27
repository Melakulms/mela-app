import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipSessionJourney from '../src/components/MentorshipSessionJourney'
import type { MentorshipSession } from '../src/lib/mentorship'

const mocks = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn(), read: vi.fn(), insert: vi.fn(), update: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { from: mocks.from, auth: { getUser: mocks.getUser } } }))
const session: MentorshipSession = {
  id:'s1', request_id:'r1', mentor_id:'m1', mentee_id:'learner', scheduled_at:'2099-01-01T10:00:00Z',
  duration_min:30, status:'scheduled', call_room_id:null, completed_at:null, cancelled_at:null, rating:null, rating_comment:null,
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'learner'}},error:null})
  mocks.read.mockResolvedValue({data:[],error:null})
  mocks.insert.mockResolvedValue({error:null})
  mocks.update.mockResolvedValue({data:[{id:'p1'}],error:null})
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({eq: (field: string, value: string) => ({in: (key: string, ids: string[]) => mocks.read(table, field, value, key, ids)})}),
    insert: (payload: unknown) => mocks.insert(table,payload),
    update: (payload: unknown) => ({eq: (_key:string,id:string) => ({select: () => mocks.update(table,id,payload)})}),
  }))
})
afterEach(cleanup)
async function selectSession() {
  await waitFor(() => expect((screen.getByLabelText('Select session') as HTMLSelectElement).disabled).toBe(false))
  fireEvent.change(screen.getByLabelText('Select session'),{target:{value:'s1'}})
}
function fillPreparation() {
  fireEvent.change(screen.getByLabelText('Session goal'),{target:{value:'Prepare my portfolio'}})
  fireEvent.change(screen.getByLabelText('My discussion questions or topics'),{target:{value:'How can I improve my first project?'}})
}

describe('Private session journey', () => {
  it('does not load private notes or offer writes without confirmed sessions', () => {
    render(<MentorshipSessionJourney sessions={[{...session,status:'cancelled'}]} />)
    expect(screen.queryByLabelText('Select session')).toBeNull()
    expect(mocks.getUser).not.toHaveBeenCalled()
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('scopes reads to signed-in learner and selected session history and saves preparation', async () => {
    render(<MentorshipSessionJourney sessions={[session]} />)
    await selectSession()
    expect(mocks.read).toHaveBeenCalledWith('mentorship_session_preparations','learner_id','learner','session_id',['s1'])
    fillPreparation()
    fireEvent.click(screen.getByRole('button',{name:'Save my preparation'}))
    expect(await screen.findByText('Your private session preparation was saved.')).toBeTruthy()
    expect(mocks.insert).toHaveBeenCalledWith('mentorship_session_preparations',{
      session_id:'s1',learner_id:'learner',goal:'Prepare my portfolio',questions:'How can I improve my first project?',
    })
    expect(screen.queryByLabelText('What I learned')).toBeNull()
  })
  it('retains the draft after rejected writes and allows a retry', async () => {
    mocks.insert.mockResolvedValueOnce({error:{message:'Offline'}})
    render(<MentorshipSessionJourney sessions={[session]} />)
    await selectSession(); fillPreparation()
    fireEvent.click(screen.getByRole('button',{name:'Save my preparation'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Offline')
    expect((screen.getByLabelText('Session goal') as HTMLInputElement).value).toBe('Prepare my portfolio')
    fireEvent.click(screen.getByRole('button',{name:'Save my preparation'}))
    await screen.findByText('Your private session preparation was saved.')
    expect(mocks.insert).toHaveBeenCalledTimes(2)
  })
  it('blocks editing when reads fail and recovers through retry', async () => {
    mocks.read.mockResolvedValueOnce({data:null,error:{message:'Notes unavailable'}})
    render(<MentorshipSessionJourney sessions={[session]} />)
    await screen.findByRole('alert'); await selectSession()
    expect(screen.queryByLabelText('Session goal')).toBeNull()
    expect(mocks.insert).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Retry private notes'}))
    expect(await screen.findByLabelText('Session goal')).toBeTruthy()
  })
  it('requires sign-in before reading private records', async () => {
    mocks.getUser.mockResolvedValue({data:{user:null},error:null})
    render(<MentorshipSessionJourney sessions={[session]} />)
    expect((await screen.findByRole('alert')).textContent).toContain('Sign in')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('does not claim a successful update when permissions return no row', async () => {
    mocks.read.mockImplementation((table: string) => Promise.resolve({error:null,data:table.endsWith('preparations')
      ? [{id:'p1',session_id:'s1',goal:'Existing goal',questions:'Existing questions',updated_at:'2026-01-01'}] : []}))
    mocks.update.mockResolvedValue({data:[],error:null})
    render(<MentorshipSessionJourney sessions={[session]} />)
    await selectSession(); fillPreparation()
    fireEvent.click(screen.getByRole('button',{name:'Update my private preparation'}))
    expect((await screen.findByRole('alert')).textContent).toContain('was not updated')
    expect(screen.queryByText('Your private session preparation was saved.')).toBeNull()
  })
  it('records a completed session reflection as self-reported without awarding credentials', async () => {
    render(<MentorshipSessionJourney sessions={[{...session,status:'completed',completed_at:'2099-01-01T10:30:00Z'}]} />)
    await selectSession()
    fireEvent.change(screen.getByLabelText('What I learned'),{target:{value:'I learned to describe my project outcomes.'}})
    fireEvent.change(screen.getByLabelText('My next practical step'),{target:{value:'Revise portfolio'}})
    fireEvent.click(screen.getByRole('button',{name:'Save self-reported reflection'}))
    await screen.findByText(/Your private reflection was saved/)
    expect(mocks.insert).toHaveBeenCalledWith('mentorship_session_reflections',{
      session_id:'s1',learner_id:'learner',learning_summary:'I learned to describe my project outcomes.',next_step:'Revise portfolio',
    })
    expect(mocks.insert).toHaveBeenCalledTimes(1)
  })
})
