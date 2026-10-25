import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import SchoolChapterLibrary, { ChapterStudyResources } from '../src/components/SchoolChapterLibrary'

const mocks=vi.hoisted(()=>({rpc:vi.fn(),from:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{rpc:mocks.rpc,from:mocks.from}}))

beforeEach(()=>{
  vi.resetAllMocks()
  mocks.from.mockImplementation((table:string)=>{
    const query:any={
      select:()=>query,
      eq:()=>query,
      order:()=>Promise.resolve({data:table==='mela_learning_chapters'
        ? [{id:'chapter-1',chapter_number:1,title:'Numbers up to 20'}]
        : [{material_key:'grade1-math-lesson',title:'Numbers practice lesson',material_type:'lesson',summary:null}],error:null}),
    }
    return query
  })
  mocks.rpc.mockResolvedValue({data:{
    material_key:'grade1-math-lesson',title:'Numbers practice lesson',
    grade_level:1,stage_key:'school_1_6',chapter_title:'Numbers up to 20',
    content_markdown:'Count real objects up to 20.',locked:false,
  },error:null})
})
afterEach(cleanup)

it('shows the free Grade 1 chapter lesson and connects learning to practice',async()=>{
  const practice=vi.fn()
  render(<SchoolChapterLibrary programKey="g1_math" grade={1} stageKey="school_1_6" onOpenPractice={practice}/>)
  const chapter=await screen.findByRole('option',{name:/Chapter 1: Numbers up to 20/})
  fireEvent.change(screen.getByLabelText('Choose a chapter to study'),{target:{value:(chapter as HTMLOptionElement).value}})
  const open=await screen.findByText('Numbers practice lesson')
  expect(open).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Read'}))
  expect(await screen.findByText('Count real objects up to 20.')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:/Practice my registered grade/}))
  expect(practice).toHaveBeenCalledOnce()
})

it('rejects a material response from a different grade',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:{
    material_key:'grade1-math-lesson',title:'Another grade',
    grade_level:9,stage_key:'school_9_10',chapter_title:'Numbers up to 20',
    content_markdown:'Not your curriculum',locked:false,
  },error:null})
  render(<ChapterStudyResources chapterId="chapter-1" chapterTitle="Numbers up to 20" grade={1} stageKey="school_1_6"/>)
  await screen.findByText('Numbers practice lesson')
  fireEvent.click(screen.getByRole('button',{name:'Read'}))
  expect((await screen.findByRole('alert')).textContent).toContain('did not match your saved grade')
  expect(screen.queryByText('Not your curriculum')).toBeNull()
})

it('does not query materials for an inconsistent stage and grade',async()=>{
  render(<ChapterStudyResources chapterId="chapter-1" chapterTitle="Numbers up to 20" grade={1} stageKey="school_9_10"/>)
  expect((await screen.findByRole('alert')).textContent).toContain('do not match')
  expect(mocks.from).not.toHaveBeenCalled()
})
