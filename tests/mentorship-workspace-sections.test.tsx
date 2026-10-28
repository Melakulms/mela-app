import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorshipLearningWorkspace from '../src/components/MentorshipLearningWorkspace'
const mocks=vi.hoisted(()=>({load:vi.fn(),add:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{}}))
vi.mock('../src/components/MentorshipGroupInterest',()=>({default:()=>null}))
vi.mock('../src/lib/mentorship-workspace',()=>({
 loadMentorshipWorkspace:mocks.load,addMentorshipGoal:mocks.add,
 assignmentProgress:()=>({assigned:0,submitted:0,reviewed:0}),
 deleteMentorshipGoal:vi.fn(),createMentorshipAssignment:vi.fn(),sendMentorshipFeedback:vi.fn(),setMentorshipGoalStatus:vi.fn(),submitMentorshipAssignment:vi.fn()
}))
beforeEach(()=>{
 vi.resetAllMocks()
 mocks.load.mockResolvedValue({goals:[],assignments:[],submissions:[],feedback:[],groups:[],resources:[{id:'r1',title:'Prepare for mentoring',category:'Preparation',description:'Make a plan',content:'Write three questions.'}]})
 mocks.add.mockResolvedValue(undefined)
})
afterEach(cleanup)
it('shows actual resource content without unrelated goal forms and switches to goal creation',async()=>{
 const {rerender}=render(<MentorshipLearningWorkspace mode="learner" section={10}/>)
 await screen.findByText('Prepare for mentoring')
 expect(mocks.load).toHaveBeenCalledWith('learner',10)
 expect(screen.queryByRole('textbox',{name:'Goal title'})).toBeNull()
 fireEvent.click(screen.getByText('Prepare for mentoring'))
 expect(screen.getByText('Write three questions.')).toBeTruthy()
 rerender(<MentorshipLearningWorkspace mode="learner" section={9}/>)
 fireEvent.change(await screen.findByRole('textbox',{name:'Goal title'}),{target:{value:'Prepare a portfolio'}})
 fireEvent.click(screen.getByRole('button',{name:'Add personal goal'}))
 await waitFor(()=>expect(mocks.add).toHaveBeenCalledWith('Prepare a portfolio','',''))
 expect(mocks.load).toHaveBeenCalledWith('learner',9)
})
it('shows a recoverable error rather than leaving a section blank',async()=>{
 mocks.load.mockRejectedValueOnce(new Error('Resources unavailable'))
 render(<MentorshipLearningWorkspace mode="learner" section={10}/>)
 expect((await screen.findByRole('alert')).textContent).toContain('Resources unavailable')
 fireEvent.click(screen.getByRole('button',{name:'Retry'}))
 await screen.findByText('Prepare for mentoring')
 expect(screen.queryByRole('alert')).toBeNull()
})
