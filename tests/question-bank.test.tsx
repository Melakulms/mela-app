import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import QuestionBank from '../src/pages/QuestionBank'
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), profile: vi.fn(), programs: vi.fn(), student: vi.fn(), catalog: vi.fn(), rpc: vi.fn(), eq: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: {
  auth: { getUser: mocks.getUser }, rpc: mocks.rpc,
  from: (table: string) => { const query: any = { select: () => query, eq: (field: string, value: unknown) => { mocks.eq(field, value); return query }, maybeSingle: table === 'student_profiles' ? mocks.student : mocks.profile, order: mocks.programs, then: (done: any, failed: any) => mocks.catalog().then(done, failed) }; return query },
} }))
const detail = { program: { mastery_count: 20, review_required_count: 10 }, chapters: [{ chapter_id: 'c1', chapter_title: 'Algebra', mastery_count: 20, topics: [{ topic_id: 't1', topic_title: 'Equations', mastery_count: 20 }] }] }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'learner' } } })
  mocks.profile.mockResolvedValue({ data: { education_stage_key: 'school_7_8', grade_level: 8 } })
  mocks.student.mockResolvedValue({ data: { subjects: ['mathematics'] } })
  mocks.catalog.mockResolvedValue({ data: [{ subject_key: 'mathematics', stage_key: 'school_7_8', track_key: 'common', optional: false }], error: null })
  mocks.programs.mockResolvedValue({ data: [{ program_key: 'math', subject_key: 'mathematics', subject_title: 'Math', track_key: 'common', stage_key: 'school_7_8', grade_level: 8 }] })
  mocks.rpc.mockImplementation(async (name: string) => name === 'get_question_subject_detail_v18' ? { data: detail } : { data: { session_id: 'session', questions: [{ id: 'q1', prompt: 'Calculate', choices: [], question_type: 'numeric' }, { id: 'q2', prompt: 'Choose one', choices: [{ id: 'A', text: 'First choice' }, { id: 'B', text: 'Second choice' }], question_type: 'single_choice' }] } })
})
afterEach(cleanup)
it('surfaces network errors and reloads subjects', async () => {
  mocks.getUser.mockRejectedValueOnce(new Error('Offline'))
  render(<QuestionBank onBack={vi.fn()} />)
  await screen.findByRole('alert'); fireEvent.click(screen.getByText('Reload subjects'))
  await screen.findByRole('option', { name: 'Math' })
  expect(screen.queryByRole('alert')).toBeNull()
})
it('requires a school grade instead of exposing all grades', async () => {
  mocks.profile.mockResolvedValue({ data: { education_stage_key: 'school_7_8', grade_level: null } })
  render(<QuestionBank onBack={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toContain('saved school grade')
  expect(mocks.programs).not.toHaveBeenCalled()
})
it('filters saved-grade curriculum and submits typed answers; retry preserves answers and shows real counts', async () => {
  expect(mocks.eq).not.toHaveBeenCalled()
  render(<QuestionBank onBack={vi.fn()} />)
  await screen.findByRole('option', { name: 'Algebra (20 validated)' })
  fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: 'c1' } })
  fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 't1' } })
  fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '2' } })
  fireEvent.click(screen.getByText('Start practice'))
  const written = await screen.findByLabelText('Calculate')
  expect(mocks.rpc).toHaveBeenCalledWith('start_mela_filtered_question_session_v18', { p_program_key: 'math', p_chapter_id: 'c1', p_topic_id: 't1', p_count: 10, p_difficulty: 2, p_practice_mode: 'mastery' })
  expect((written as HTMLInputElement).type).toBe('number')
  fireEvent.click(screen.getByText('First choice'))
  expect((screen.getByText('Submit session') as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(written, { target: { value: '42' } })
  mocks.rpc.mockResolvedValueOnce({ error: { message: 'Network interrupted' } })
  fireEvent.click(screen.getByText('Submit session'))
  await screen.findByText('Network interrupted')
  expect((written as HTMLInputElement).value).toBe('42')
  mocks.rpc.mockResolvedValueOnce({ data: { score_percent: 100, correct_count: 2, answered_count: 2, details: [{ question_id: 'q1', correct: true, rationale: 'Explanation' }] } })
  fireEvent.click(screen.getByText('Submit session'))
  await screen.findByText('Question Bank Result')
  expect(mocks.rpc).toHaveBeenLastCalledWith('submit_mela_question_session_v12', { p_session_id: 'session', p_answers: [{ question_id: 'q1', response: '42' }, { question_id: 'q2', response: 'A' }] })
  expect(screen.getByText('Explanation')).toBeTruthy()
  await waitFor(() => expect(screen.getByText('2')).toBeTruthy())
})

it('explains unavailable mastery selections and lets the learner clear restrictive filters', async () => {
  render(<QuestionBank onBack={vi.fn()} />)
  await screen.findByRole('option', { name: 'Algebra (20 validated)' })
  fireEvent.change(screen.getByLabelText('Chapter'), { target: { value: 'c1' } })
  fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 't1' } })
  fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '5' } })
  mocks.rpc.mockResolvedValueOnce({ error: { message: 'mastery rebuild in progress for this filter: only 0 accessible mastery questions are currently available' } })
  fireEvent.click(screen.getByRole('button', { name: 'Start practice' }))
  await screen.findByText(/Only 0 accessible mastery questions match this selection/)
  expect(screen.queryByText('mastery rebuild in progress')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Clear chapter, topic and difficulty filters' }))
  expect((screen.getByLabelText('Chapter') as HTMLSelectElement).value).toBe('')
  expect((screen.getByLabelText('Topic') as HTMLSelectElement).value).toBe('')
  expect((screen.getByLabelText('Difficulty') as HTMLSelectElement).value).toBe('')
  expect(screen.getByRole('button', { name: 'Start practice' })).toBeTruthy()
})

it('shows saved grade and uses it to select only correct programs', async () => {
  render(<QuestionBank onBack={vi.fn()} />)
  await screen.findByRole('option', { name: 'Math' })
  expect(screen.getByText(/Grade 8 curriculum/)).toBeTruthy()
  expect(mocks.eq).toHaveBeenCalledWith('stage_key','school_7_8')
  expect(mocks.eq).toHaveBeenCalledWith('grade_level',8)
  expect(screen.queryByLabelText('Choose grade')).toBeNull()
})

it('refuses any subject row outside the signed-in learner grade, even if returned incorrectly', async () => {
  mocks.programs.mockResolvedValueOnce({ data: [{ program_key:'other', subject_title:'Grade 9 Math',track_key:'common',stage_key:'school_9_10',grade_level:9 }] })
  render(<QuestionBank onBack={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toContain('outside your saved grade')
  expect(screen.queryByRole('option', { name: 'Grade 9 Math' })).toBeNull()
})

it('sends incomplete profiles to the profile editor rather than choosing a grade in Practice', async () => {
  mocks.profile.mockResolvedValue({ data: { education_stage_key:'school_7_8',grade_level:null } })
  const onOpenProfile=vi.fn()
  render(<QuestionBank onBack={vi.fn()} onOpenProfile={onOpenProfile} />)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button',{name:'Complete or correct my education profile'}))
  expect(onOpenProfile).toHaveBeenCalledTimes(1)
})
