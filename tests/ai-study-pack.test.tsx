import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'
import {readFileSync} from 'node:fs'
import LessonText from '../src/components/LessonText'
import {buildCourseStudyPack} from '../src/lib/course-study-pack'
afterEach(cleanup)
it('opens standalone HTTPS resources safely while leaving executable content as text',()=>{
 const {container}=render(<LessonText text={'Suggested channel\nhttps://www.youtube.com/@IBMTechnology\n\njavascript:alert(1)\n\n<img src=x onerror=alert(1)>'}/>)
 const link=screen.getByRole('link')
 expect(link.getAttribute('href')).toBe('https://www.youtube.com/@IBMTechnology')
 expect(link.getAttribute('rel')).toBe('noopener noreferrer')
 expect(screen.getAllByRole('link')).toHaveLength(1)
 expect(container.querySelector('img')).toBeNull()
})
it('exports ordered readable lessons, workbook, resource URL and honest timing',()=>{
 const lessons=[
 {lesson_key:'six',title:'Project',position:6,content_text:'Project workbook\nhttps://www.youtube.com/@statquest',duration_minutes:40,review_status:'draft'},
 {lesson_key:'one',title:'Intro',position:1,content_text:'Introduction',duration_minutes:20,review_status:'draft'}]
 const result=buildCourseStudyPack('Example',lessons)
 expect(result).toContain('60 minutes')
 expect(result.indexOf('Lesson 1:')).toBeLessThan(result.indexOf('Lesson 6:'))
 expect(result).toContain('Project workbook')
 expect(result).toContain('https://www.youtube.com/@statquest')
 expect(result).toContain('does not submit work')
 expect(lessons[0].position).toBe(6)
})
it('covers every course with a workbook, HTTPS resources and a consistent workload',()=>{
 const pack=JSON.parse(readFileSync('content/ai-course-support-1.2.0.json','utf8'))
 expect(pack.courses).toHaveLength(53)
 expect(new Set(pack.lesson_updates.map((x:any)=>x.lesson_key)).size).toBe(318)
 for(const c of pack.courses){
  expect(c.lesson_minutes.reduce((n:number,m:number)=>n+m,0)).toBe(c.estimated_minutes)
  expect(c.estimated_minutes).toBeGreaterThanOrEqual(60)
  expect(c.estimated_minutes).toBeLessThanOrEqual(480)
  expect(c.resources).toHaveLength(2)
  for(const r of c.resources)expect(new URL(r.url).hostname).toBe('www.youtube.com')
  const project=pack.lesson_updates.find((l:any)=>l.lesson_key===c.lessons[5].lesson_key)
  expect(project.append_text).toContain(c.project_brief)
  expect(project.append_text).toContain('Document 6: Reflection')
 }
})
it('sums foundation session budgets without requiring 52 weeks of waiting',()=>{
 const f=JSON.parse(readFileSync('src/lib/ai-year-one-draft.json','utf8'))
 expect(f.lessons).toHaveLength(52)
 expect(f.lessons.reduce((n:number,l:any)=>n+l.estimated_minutes,0)).toBe(f.hours*60)
 expect(f.hours).toBe(49)
 for(const l of f.lessons)expect(l.sessions.reduce((n:number,s:any)=>n+s.minutes,0)).toBe(l.estimated_minutes)
 expect(f.pacing_note).toContain('optional, not required')
})
