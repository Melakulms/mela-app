// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipProgramPlanner from '../src/components/MentorshipProgramPlanner'

const mocks=vi.hoisted(()=>({load:vi.fn(),add:vi.fn(),status:vi.fn()}))
vi.mock('../src/lib/mentorship-workspace',()=>({
  loadMentorshipWorkspace:mocks.load,
  addMentorshipGoal:mocks.add,
  setMentorshipGoalStatus:mocks.status,
}))
const empty={goals:[],assignments:[],submissions:[],feedback:[],resources:[],groups:[]}
const saved={
  id:'goal-1',learner_id:'learner-1',
  title:'Mentorship plan: Academic learning · Starter (2 weeks)',
  detail:'Week 1: Choose one curriculum topic and record what I already know.',
  status:'planned',target_date:null,created_at:'2026-10-28',
}
beforeEach(()=>{
  vi.resetAllMocks()
  mocks.load.mockResolvedValue(empty)
  mocks.add.mockResolvedValue(undefined)
  mocks.status.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('Mentorship section 6 structured programs',()=>{
  it('offers age-safe academic study tracks without promising a mentor or admission',async()=>{
    render(<MentorshipProgramPlanner stageKey="school_1_6"/>)
    await screen.findByText('No personal program plans saved yet.')
    expect((screen.getByLabelText('Learning area') as HTMLSelectElement).options).toHaveLength(1)
    expect(screen.getByText(/academic self-study plans/)).toBeTruthy()
    expect(screen.getByText(/not mentor assignment or formal program enrollment/i)).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(mocks.load).toHaveBeenCalledWith('learner',9)
    expect(mocks.add).not.toHaveBeenCalled()
  })
  it('shows eight explicit weekly milestones for an eligible advanced learner',async()=>{
    render(<MentorshipProgramPlanner stageKey="university"/>)
    await screen.findByText('No personal program plans saved yet.')
    expect((screen.getByLabelText('Learning area') as HTMLSelectElement).options).toHaveLength(4)
    fireEvent.change(screen.getByLabelText('Learning area'),{target:{value:'scholarship'}})
    fireEvent.change(screen.getByLabelText('Program length'),{target:{value:'intensive'}})
    expect(screen.getByRole('heading',{name:'Intensive plan — 8 weeks'})).toBeTruthy()
    expect(screen.getAllByRole('listitem')).toHaveLength(8)
    expect(screen.getByText(/Check official application deadlines/)).toBeTruthy()
    expect(mocks.add).not.toHaveBeenCalled()
  })
  it('saves only when the user confirms and includes visible milestones in the private goal',async()=>{
    render(<MentorshipProgramPlanner stageKey="college_tvet"/>)
    await screen.findByText('No personal program plans saved yet.')
    fireEvent.change(screen.getByLabelText('My additional next step (optional)'),{
      target:{value:'Practise with my approved teacher'},
    })
    fireEvent.change(screen.getByLabelText('My target date (optional)'),{
      target:{value:'2026-12-01'},
    })
    expect(mocks.add).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Save my personal program plan'}))
    await waitFor(()=>expect(mocks.add).toHaveBeenCalledTimes(1))
    const [title,detail,targetDate]=mocks.add.mock.calls[0]
    expect(title).toBe('Mentorship plan: Academic learning · Starter (2 weeks)')
    expect(detail).toContain('Week 1:')
    expect(detail).toContain('Week 2:')
    expect(detail).toContain('Practise with my approved teacher')
    expect(detail).toContain('not mentor assignment or formal program enrollment')
    expect(targetDate).toBe('2026-12-01')
    expect(await screen.findByText(/Your personal plan was saved/)).toBeTruthy()
  })
  it('blocks new writes when private goal history cannot be verified and supports retry',async()=>{
    mocks.load.mockRejectedValueOnce(new Error('Private goals unavailable')).mockResolvedValue(empty)
    render(<MentorshipProgramPlanner stageKey="university"/>)
    expect((await screen.findByRole('alert')).textContent).toContain('Private goals unavailable')
    expect((screen.getByRole('button',{name:'Save my personal program plan'}) as HTMLButtonElement).disabled).toBe(true)
    expect(mocks.add).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Retry my program plans'}))
    await screen.findByText('No personal program plans saved yet.')
    expect((screen.getByRole('button',{name:'Save my personal program plan'}) as HTMLButtonElement).disabled).toBe(false)
  })
  it('prevents duplicate plan saves and permits self-reported progress changes',async()=>{
    mocks.load.mockResolvedValue({...empty,goals:[saved]})
    render(<MentorshipProgramPlanner stageKey="university"/>)
    await screen.findByText('You already saved this program plan. Change its status below or open My Mentorship to edit its milestones.')
    expect(screen.queryByRole('button',{name:'Save my personal program plan'})).toBeNull()
    fireEvent.change(screen.getByLabelText('Personal progress status'),{target:{value:'in_progress'}})
    await waitFor(()=>expect(mocks.status).toHaveBeenCalledWith('goal-1','in_progress'))
    expect(mocks.add).not.toHaveBeenCalled()
    expect(await screen.findByText(/personal plan status was saved/)).toBeTruthy()
  })
  it('keeps a personal draft after backend save failure and allows retry',async()=>{
    mocks.add.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined)
    render(<MentorshipProgramPlanner stageKey="university"/>)
    await screen.findByText('No personal program plans saved yet.')
    fireEvent.change(screen.getByLabelText('My additional next step (optional)'),{
      target:{value:'Review three exercises each morning'},
    })
    fireEvent.click(screen.getByRole('button',{name:'Save my personal program plan'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Offline')
    expect((screen.getByLabelText('My additional next step (optional)') as HTMLTextAreaElement).value)
      .toBe('Review three exercises each morning')
    fireEvent.click(screen.getByRole('button',{name:'Save my personal program plan'}))
    await waitFor(()=>expect(mocks.add).toHaveBeenCalledTimes(2))
  })
  it('provides real navigation to saved plans and assignments',async()=>{
    const navigate=vi.fn()
    render(<MentorshipProgramPlanner stageKey="school_9_10" onNavigate={navigate}/>)
    await screen.findByText('No personal program plans saved yet.')
    fireEvent.click(screen.getByRole('button',{name:'Open My Mentorship to edit plans'}))
    fireEvent.click(screen.getByRole('button',{name:'Open real mentor assignments'}))
    expect(navigate.mock.calls).toEqual([[9],[11]])
  })
})
