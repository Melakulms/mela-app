// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import MentorshipSessionJourney from '../src/components/MentorshipSessionJourney'

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),prepRead:vi.fn(),reflectionRead:vi.fn(),
  prepInsert:vi.fn(),reflectionInsert:vi.fn(),prepUpdate:vi.fn(),
}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    auth:{getUser:mocks.getUser},
    from:(table:string)=>{
      if(table==='mentorship_session_preparations')return{
        select:()=>({eq:()=>({in:mocks.prepRead})}),
        insert:(payload:unknown)=>({select:()=>mocks.prepInsert(payload)}),
        update:mocks.prepUpdate,
      }
      if(table==='mentorship_session_reflections')return{
        select:()=>({eq:()=>({in:mocks.reflectionRead})}),
        insert:(payload:unknown)=>({select:()=>mocks.reflectionInsert(payload)}),
      }
      throw new Error('Unexpected table '+table)
    },
  },
}))
const session=(status:'scheduled'|'completed',id='session-1')=>({
  id,request_id:'request-1',mentor_id:'mentor-1',mentee_id:'learner-1',
  status,scheduled_at:'2026-10-25T10:00:00Z',duration_min:30,
  call_room_id:null,completed_at:status==='completed'?'2026-10-25T10:30:00Z':null,
  cancelled_at:null,rating:null,rating_comment:null,
} as any)
beforeEach(()=>{
 vi.clearAllMocks()
 mocks.getUser.mockResolvedValue({data:{user:{id:'learner-1'}},error:null})
 mocks.prepRead.mockResolvedValue({data:[],error:null})
 mocks.reflectionRead.mockResolvedValue({data:[],error:null})
 mocks.prepInsert.mockResolvedValue({data:[{id:'preparation-id'}],error:null})
 mocks.reflectionInsert.mockResolvedValue({data:[{id:'reflection-id'}],error:null})
})
afterEach(cleanup)
describe('private mentorship session journey',()=>{
 it('does not invent sessions or verified outcomes for an empty learner',async()=>{
  render(<MentorshipSessionJourney sessions={[]}/>)
  expect(screen.getByText(/No confirmed or completed sessions yet/)).toBeTruthy()
  expect(screen.queryByText(/Save self-reported reflection/)).toBeNull()
  expect(mocks.getUser).not.toHaveBeenCalled()
 })
 it('allows preparation for a real scheduled session, not a prematurely completed reflection',async()=>{
  render(<MentorshipSessionJourney sessions={[session('scheduled')]}/>)
  await screen.findByText('Loading private session notes…').catch(()=>null)
  const picker=screen.getByLabelText('Select session')
  await waitFor(()=>expect((picker as HTMLSelectElement).disabled).toBe(false))
  fireEvent.change(picker,{target:{value:'session-1'}})
  fireEvent.change(screen.getByLabelText('Session goal'),{target:{value:'Prepare my career options'}})
  fireEvent.change(screen.getByLabelText('My discussion questions or topics'),{
    target:{value:'What practical steps can help me build a portfolio?'},
  })
  fireEvent.click(screen.getByRole('button',{name:'Save my preparation'}))
  await waitFor(()=>expect(mocks.prepInsert).toHaveBeenCalledTimes(1))
  expect(mocks.prepInsert).toHaveBeenCalledWith({
    session_id:'session-1',learner_id:'learner-1',goal:'Prepare my career options',
    questions:'What practical steps can help me build a portfolio?',
  })
  expect(screen.queryByRole('button',{name:'Save self-reported reflection'})).toBeNull()
 })
 it('reflects only after completed status and never awards a certificate',async()=>{
  render(<MentorshipSessionJourney sessions={[session('completed')]}/>)
  const picker=screen.getByLabelText('Select session')
  await waitFor(()=>expect((picker as HTMLSelectElement).disabled).toBe(false))
  fireEvent.change(picker,{target:{value:'session-1'}})
  fireEvent.change(screen.getByLabelText('What I learned'),{
    target:{value:'I learned how to prepare a professional portfolio for employers.'},
  })
  fireEvent.change(screen.getByLabelText('My next practical step'),{
    target:{value:'Create a draft portfolio'},
  })
  fireEvent.click(screen.getByRole('button',{name:'Save self-reported reflection'}))
  await waitFor(()=>expect(mocks.reflectionInsert).toHaveBeenCalledTimes(1))
  expect(mocks.reflectionInsert).toHaveBeenCalledWith({
    session_id:'session-1',learner_id:'learner-1',
    learning_summary:'I learned how to prepare a professional portfolio for employers.',
    next_step:'Create a draft portfolio',
  })
  expect(await screen.findByText(/does not issue a certificate or verified achievement/)).toBeTruthy()
 })
})


it('provides guided scholarship session questions without saving until the learner confirms',async()=>{
  render(<MentorshipSessionJourney sessions={[session('scheduled')]} />)
  const select=screen.getByLabelText('Select session') as HTMLSelectElement
  await waitFor(()=>expect(select.disabled).toBe(false))
  fireEvent.change(select,{target:{value:'session-1'}})
  fireEvent.click(screen.getByRole('button',{name:'Use Scholarship planning starter'}))
  expect((screen.getByLabelText('Session goal') as HTMLInputElement).value).toContain('scholarship application plan')
  expect((screen.getByLabelText('My discussion questions or topics') as HTMLTextAreaElement).value).toContain('avoid scams')
  expect(mocks.prepInsert).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button',{name:'Save my preparation'}))
  await waitFor(()=>expect(mocks.prepInsert).toHaveBeenCalledOnce())
})


it('does not falsely report a successfully saved session plan if no record was confirmed',async()=>{
  mocks.prepInsert.mockResolvedValue({data:[],error:null})
  render(<MentorshipSessionJourney sessions={[session('scheduled')]}/>)
  const picker=screen.getByLabelText('Select session') as HTMLSelectElement
  await waitFor(()=>expect(picker.disabled).toBe(false))
  fireEvent.change(picker,{target:{value:'session-1'}})
  fireEvent.change(screen.getByLabelText('Session goal'),{target:{value:'Plan a study session'}})
  fireEvent.change(screen.getByLabelText('My discussion questions or topics'),{target:{value:'What should I practise and how often?'}})
  fireEvent.click(screen.getByRole('button',{name:'Save my preparation'}))
  expect((await screen.findByRole('alert')).textContent).toContain('not confirmed by the database')
  expect(screen.queryByText('Your private session preparation was saved.')).toBeNull()
  expect((screen.getByLabelText('Session goal') as HTMLInputElement).value).toBe('Plan a study session')
})


it('does not claim a reflection was saved if no persisted record was confirmed',async()=>{
  mocks.reflectionInsert.mockResolvedValue({data:[],error:null})
  render(<MentorshipSessionJourney sessions={[session('completed')]} />)
  const picker=screen.getByLabelText('Select session') as HTMLSelectElement
  await waitFor(()=>expect(picker.disabled).toBe(false))
  fireEvent.change(picker,{target:{value:'session-1'}})
  fireEvent.change(screen.getByLabelText('What I learned'),{
    target:{value:'I learned how to describe two practical training choices.'},
  })
  fireEvent.change(screen.getByLabelText('My next practical step'),{
    target:{value:'Draft a list of skills to practise'},
  })
  fireEvent.click(screen.getByRole('button',{name:'Save self-reported reflection'}))
  expect((await screen.findByRole('alert')).textContent).toContain('Private reflection was not confirmed')
  expect(screen.queryByText(/Your private reflection was saved/)).toBeNull()
  expect((screen.getByLabelText('What I learned') as HTMLTextAreaElement).value).toContain('two practical')
})


it('clears private notes and reloads only the current account after session boundary',async()=>{
  mocks.prepRead.mockResolvedValueOnce({data:[{
    id:'private-note-1',session_id:'session-1',goal:'First account private goal',
    questions:'Private planning details from first account',updated_at:'2026-10-28',
  }],error:null}).mockResolvedValue({data:[],error:null})
  render(<MentorshipSessionJourney sessions={[session('completed')]}/>)
  const picker=screen.getByLabelText('Select session') as HTMLSelectElement
  await waitFor(()=>expect(picker.disabled).toBe(false))
  fireEvent.change(picker,{target:{value:'session-1'}})
  expect((screen.getByLabelText('Session goal') as HTMLInputElement).value).toBe('First account private goal')
  fireEvent.change(screen.getByLabelText('Session goal'),{target:{value:'Unsent private draft'}})

  fireEvent(window,new Event('mela:session-boundary'))
  expect((picker as HTMLSelectElement).value).toBe('')
  expect(screen.queryByDisplayValue('Unsent private draft')).toBeNull()
  await waitFor(()=>expect(mocks.prepRead).toHaveBeenCalledTimes(2))
  await waitFor(()=>expect(picker.disabled).toBe(false))
  fireEvent.change(picker,{target:{value:'session-1'}})
  expect((screen.getByLabelText('Session goal') as HTMLInputElement).value).toBe('')
  expect(screen.queryByDisplayValue('First account private goal')).toBeNull()
})

it('ignores a previous accounts late save response after sign-out',async()=>{
  let resolveSave:(value:unknown)=>void=()=>{}
  mocks.prepInsert.mockImplementationOnce(()=>new Promise(resolve=>{resolveSave=resolve}))
  render(<MentorshipSessionJourney sessions={[session('scheduled')]}/>)
  const picker=screen.getByLabelText('Select session') as HTMLSelectElement
  await waitFor(()=>expect(picker.disabled).toBe(false))
  fireEvent.change(picker,{target:{value:'session-1'}})
  fireEvent.change(screen.getByLabelText('Session goal'),{target:{value:'Confidential first account goal'}})
  fireEvent.change(screen.getByLabelText('My discussion questions or topics'),{
    target:{value:'These questions are private to the first account only.'},
  })
  fireEvent.click(screen.getByRole('button',{name:'Save my preparation'}))
  await waitFor(()=>expect(mocks.prepInsert).toHaveBeenCalledOnce())
  fireEvent(window,new Event('mela:session-boundary'))
  resolveSave({data:[{id:'old-save'}],error:null})
  await waitFor(()=>expect(mocks.prepRead).toHaveBeenCalledTimes(2))
  expect(screen.queryByText('Your private session preparation was saved.')).toBeNull()
  expect(screen.queryByDisplayValue('Confidential first account goal')).toBeNull()
})
