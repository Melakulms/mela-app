import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CourseReader from '../src/components/CourseReader'
const api=vi.hoisted(()=>({fetchCourseLessons:vi.fn(),fetchCompletedLessons:vi.fn(),completeCourseLesson:vi.fn()}))
vi.mock('../src/lib/academy',()=>api)
const course={id:'course',title:'Career basics',description:null,category:null,level:null,duration_minutes:null,price_cents:0}
beforeEach(()=>{vi.resetAllMocks();api.fetchCourseLessons.mockResolvedValue([{id:'lesson',title:'First lesson',module_title:'Introduction',content_text:'<script>not executable</script>'}]);api.fetchCompletedLessons.mockResolvedValue([])})
afterEach(cleanup)
it('reads lessons safely and only shows completion after persistence succeeds',async()=>{
 api.completeCourseLesson.mockRejectedValueOnce(new Error('Network unavailable')).mockResolvedValueOnce(undefined)
 render(<CourseReader course={course} onBack={()=>{}} />)
 await screen.findByText('<script>not executable</script>')
 fireEvent.click(screen.getByRole('button',{name:'Mark lesson complete'}))
 await screen.findByRole('alert')
 expect(screen.queryByRole('button',{name:'Lesson completed'})).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Mark lesson complete'}))
 await screen.findByRole('button',{name:'Lesson completed'})
 expect(api.completeCourseLesson).toHaveBeenCalledTimes(2)
 expect(screen.getByText('1 of 1 lessons completed')).toBeTruthy()
})
it('restores completed lessons and recovers from a loading failure',async()=>{
 api.fetchCourseLessons.mockRejectedValueOnce(new Error('Offline'))
 api.fetchCompletedLessons.mockResolvedValue(['lesson'])
 render(<CourseReader course={course} onBack={()=>{}} />)
 fireEvent.click(await screen.findByRole('button',{name:'Reload lessons'}))
 const button=await screen.findByRole('button',{name:'Lesson completed'})
 expect((button as HTMLButtonElement).disabled).toBe(true)
 expect(api.completeCourseLesson).not.toHaveBeenCalled()
})
