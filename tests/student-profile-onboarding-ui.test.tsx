import { afterEach, expect, it, vi } from 'vitest'

vi.mock('../src/lib/supabase', () => {
  const query = {
    select() { return this },
    eq() { return this },
    order() { return Promise.resolve({data: [], error: null}) },
    maybeSingle() { return Promise.resolve({data: null, error: null}) },
  }
  return {
    supabase: {
      from: () => query,
      auth: {getUser: async () => ({data: {user: null}, error: null})},
    },
  }
})
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import StudentOnboarding from '../src/pages/StudentOnboarding'

afterEach(cleanup)

it('blocks learning until a real education level, grade and subject catalog are chosen', () => {
  render(<StudentOnboarding onComplete={() => { throw Error('Must not complete') }} />)
  expect(screen.getByRole('heading',{name:'Complete your education profile'})).toBeTruthy()
  expect((screen.getByLabelText('Education level (required)') as HTMLSelectElement).value).toBe('')
  expect(screen.queryByLabelText('School grade (required)')).toBeNull()
  expect((screen.getByRole('button',{name:'Complete profile & open MELA'}) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.getByText(/do not need to provide a date of birth/)).toBeTruthy()
})

it('locks verified profile edits but lets unfinished learners choose their grade', () => {
  render(<StudentOnboarding initialStage="school_9_10" initialGrade={9} editMode onComplete={() => {}} />)
  const grade=screen.getByLabelText('School grade (required)') as HTMLSelectElement
  const level=screen.getByLabelText('Education level (required)') as HTMLSelectElement
  expect(grade.value).toBe('9')
  expect(grade.disabled).toBe(true)
  expect(level.disabled).toBe(true)
  expect(screen.getByText(/Grade 9 is already saved/)).toBeTruthy()
})

it('does not offer a different grade when an incomplete school profile has already saved its grade', () => {
  render(<StudentOnboarding initialStage="school_9_10" initialGrade={9} onComplete={() => {}} />)
  const grade = screen.getByLabelText('School grade (required)') as HTMLSelectElement
  expect(grade.value).toBe('9')
  expect(grade.disabled).toBe(true)
  expect(screen.getByText(/Grade 9 is already saved/)).toBeTruthy()
})

it('allows grade selection in an incomplete profile even when an education stage is present', () => {
  render(<StudentOnboarding initialStage="school_9_10" initialGrade={null} onComplete={() => {}} />)
  const grade=screen.getByLabelText('School grade (required)') as HTMLSelectElement
  const stage=screen.getByLabelText('Education level (required)') as HTMLSelectElement
  expect(stage.disabled).toBe(true)
  expect(grade.disabled).toBe(false)
  expect(grade.value).toBe('')
  expect(Array.from(grade.options).map(o=>o.value)).toEqual(['','9','10'])
  fireEvent.change(grade,{target:{value:'10'}})
  expect(grade.value).toBe('10')
})
