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

it('can resume an existing profile safely without offering unverified grade changes', () => {
  render(<StudentOnboarding initialStage="school_9_10" initialGrade={9} editMode onComplete={() => {}} />)
  const grade=screen.getByLabelText('School grade (required)') as HTMLSelectElement
  const level=screen.getByLabelText('Education level (required)') as HTMLSelectElement
  expect(grade.value).toBe('9')
  expect(grade.disabled).toBe(true)
  expect(level.disabled).toBe(true)
  expect(screen.getByText(/needs a verified correction by MELA support/)).toBeTruthy()
})
