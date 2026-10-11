import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import PreparedCourseReader from '../src/components/PreparedCourseReader'
import type {Course} from '../src/lib/academy'
const mocks=vi.hoisted(()=>({from:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:mocks}))
afterEach(cleanup)
it('reads live drafts without granting course completion',async()=>{
 const order=vi.fn().mockResolvedValue({data:[{lesson_key:'one',title:'First',position:1,content_text:'# First\n\nReal lesson text',duration_minutes:20,review_status:'draft'},{lesson_key:'two',title:'Second',position:2,content_text:'Second lesson text',duration_minutes:20,review_status:'approved'}],error:null})
 const eq=vi.fn(()=>({order}));mocks.from.mockReturnValue({select:()=>({eq})})
 render(<PreparedCourseReader course={{id:'course-1',title:'AI Fundamentals'} as Course} onBack={()=>{}}/>)
 await screen.findByText('Real lesson text')
 expect(eq).toHaveBeenCalledWith('course_id','course-1')
 expect(screen.queryByRole('button',{name:'Mark lesson complete'})).toBeNull()
 expect(screen.getByText(/Awaiting teacher review/)).toBeTruthy()
 fireEvent.click(screen.getByRole('button',{name:'Next lesson'}))
 expect(screen.getByText('Second lesson text')).toBeTruthy()
 expect(screen.getByText(/Teacher-reviewed/)).toBeTruthy()
})
it('offers retry after a failed load',async()=>{
 mocks.from.mockReturnValue({select:()=>({eq:()=>({order:async()=>({data:null,error:new Error('Connection unavailable')})})})})
 render(<PreparedCourseReader course={{id:'c',title:'Course'} as Course} onBack={()=>{}}/>)
 expect(await screen.findByRole('alert')).toBeTruthy()
 expect(screen.getByRole('button',{name:'Retry prepared lessons'})).toBeTruthy()
})
