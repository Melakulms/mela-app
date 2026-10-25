import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import EnrolledCurriculumSummary from '../src/components/EnrolledCurriculumSummary'

const values = vi.hoisted(() => ({
  grade: 1,
  stage: 'school_1_6',
  subjects: ['mathematics', 'environmental_science'],
  catalog: [
    {stage_key:'school_1_6',track_key:'common',subject_key:'mathematics',optional:false},
    {stage_key:'school_1_6',track_key:'common',subject_key:'environmental_science',optional:false},
  ],
  programs: [
    {program_key:'one_math',subject_title:'Mathematics',subject_key:'mathematics',grade_level:1,stage_key:'school_1_6',track_key:'common'},
    {program_key:'one_environment',subject_title:'Environmental Science',subject_key:'environmental_science',grade_level:1,stage_key:'school_1_6',track_key:'common'},
    {program_key:'nine_bio',subject_title:'Biology',subject_key:'biology',grade_level:9,stage_key:'school_9_10',track_key:'common'},
  ],
  getUser: vi.fn(),
}))

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {getUser: values.getUser},
    from: (table: string) => {
      const query: any = {
        select: () => query,
        eq: () => query,
        maybeSingle: async () => {
          if (table === 'profiles') return {data: {grade_level:values.grade,education_stage_key:values.stage},error:null}
          if (table === 'student_profiles') return {data: {subjects:values.subjects},error:null}
          return {data:null,error:null}
        },
        then: (resolve: (r: unknown) => void, reject: (e: unknown) => void) =>
          Promise.resolve({data:table === 'mela_learning_programs' ? values.programs : values.catalog,error:null}).then(resolve,reject),
      }
      return query
    },
  },
}))

beforeEach(() => {
  values.grade=1
  values.stage='school_1_6'
  values.subjects=['mathematics','environmental_science']
  values.getUser.mockResolvedValue({data:{user:{id:'student-1'}},error:null})
})
afterEach(() => {cleanup();vi.clearAllMocks()})

it('shows the actual Grade 1 curriculum and never advertises Biology',async()=>{
  const open=vi.fn()
  render(<EnrolledCurriculumSummary onOpenQuestionBank={open}/>)
  expect(await screen.findByText(/Grade 1 · 2 eligible subjects/)).toBeTruthy()
  expect(screen.getByText('Mathematics')).toBeTruthy()
  expect(screen.getByText('Environmental Science')).toBeTruthy()
  expect(screen.queryByText('Biology')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Open my grade\'s Question Bank'}))
  expect(open).toHaveBeenCalledOnce()
})

it('does not show another grade for a missing or inconsistent student profile',async()=>{
  values.grade=1
  values.stage='school_9_10'
  render(<EnrolledCurriculumSummary onOpenQuestionBank={vi.fn()}/>)
  expect(await screen.findByText(/Your real school grade or enrolled subjects are not saved yet/)).toBeTruthy()
  expect(screen.queryByText('Biology')).toBeNull()
})
