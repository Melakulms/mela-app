import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, afterEach, it, expect, vi } from 'vitest'
import EducatorContentReview from '../src/components/EducatorContentReview'
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: mocks }))
beforeEach(() => {
 vi.resetAllMocks()
 const query: any = { select: () => query, eq: () => query, order: () => query, range: async () => ({data:[{program_key:'math',subject_title:'Mathematics',grade_level:4}],error:null}) }
 mocks.from.mockReturnValue(query)
 mocks.rpc.mockImplementation(async (name: string) => ({error:null,data:
  name === 'can_review_questions_v18' ? true :
  name === 'get_question_review_queue_v18' ? [{slice_id:1,program_key:'math',slice_number:1,question_count:1,status:'pending'}] :
  name === 'get_question_review_slice_v18' ? {slice_id:1,program_key:'math',slice_number:1,status:'pending',questions:[{id:'q1',question_number:1,question_type:'short',prompt:'Two plus two?',correct_response:'4',rationale:'Add two pairs.'}]} : {items:[],summary:{}}}))
})
afterEach(cleanup)
it('requires a teacher attempt, checklist and note before saving approval',async()=>{
 render(<EducatorContentReview />)
 fireEvent.click(await screen.findByRole('tab',{name:'Question reviews'}))
 fireEvent.click(await screen.findByRole('button',{name:'Open slice'}))
 expect(screen.queryByText('Show grading evidence')).toBeNull()
 fireEvent.change(await screen.findByLabelText('Decision'),{target:{value:'approved'}})
 fireEvent.click(screen.getByRole('button',{name:'Save 1 review decision'}))
 expect(await screen.findByRole('alert')).toBeTruthy()
 expect(mocks.rpc.mock.calls.some(c=>c[0]==='review_question_slice_v18')).toBe(false)
 fireEvent.change(screen.getByLabelText('Test the question yourself before viewing the key'),{target:{value:'4'}})
 expect(screen.getByText('Show grading evidence')).toBeTruthy()
 fireEvent.click(screen.getByRole('checkbox'))
 fireEvent.change(screen.getByLabelText(/Reviewer note/),{target:{value:'Checked using two pairs and grade-level language.'}})
 fireEvent.click(screen.getByRole('button',{name:'Save 1 review decision'}))
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('review_question_slice_v18',{p_slice_id:1,p_decisions:[{question_id:'q1',decision:'approved',note:'Teacher test response: 4\nVerification: Checked using two pairs and grade-level language.'}]}))
})
it('does not load grading data when reviewer access is denied',async()=>{
 mocks.rpc.mockResolvedValue({data:false,error:null});render(<EducatorContentReview />)
 await screen.findByText('Reviewer access is not active for this account.')
 expect(mocks.rpc).toHaveBeenCalledTimes(1)
 expect(mocks.from).not.toHaveBeenCalled()
})
it('filters the review queue by program instead of silently staying on the first global page',async()=>{
 render(<EducatorContentReview />);fireEvent.click(await screen.findByRole('tab',{name:'Question reviews'}))
 await screen.findByRole('button',{name:'Open slice'})
 fireEvent.change(screen.getByLabelText('Review subject / program'),{target:{value:'math'}})
 await waitFor(()=>expect(mocks.rpc).toHaveBeenCalledWith('get_question_review_queue_v18',{p_program_key:'math',p_limit:100}))
})
