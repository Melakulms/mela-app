import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import LearnerTools from '../src/pages/LearnerTools'
import { learnerRoute } from '../src/lib/learner-routes'
import { saveTransitionStep } from '../src/lib/transition-plan'
const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: mock }))
beforeEach(() => vi.resetAllMocks())
afterEach(cleanup)

it('shows the full mastery list and filters by domain, level and search', async () => {
  mock.rpc.mockResolvedValue({ data: { domains: [{ domain_key: 'math', domain_title: 'Math' }, { domain_key: 'language', domain_title: 'Language' }], competencies: [
    { id: 'a', title: 'Algebra', domain_key: 'math', domain_title: 'Math', mastery_level: 'developing', evidence_count: 3, verified_evidence_count: 1 },
    { id: 'b', title: 'Reading', domain_key: 'language', domain_title: 'Language', mastery_level: 'mastered' },
  ] } })
  render(<LearnerTools view="mastery" onBack={vi.fn()} />)
  await screen.findByText('Algebra')
  expect(screen.getByText('Reading')).toBeTruthy()
  expect(screen.getByText('3 evidence records · 1 verified')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Domain'), { target: { value: 'math' } })
  expect(screen.queryByText('Reading')).toBeNull()
  fireEvent.change(screen.getByLabelText('Search competencies'), { target: { value: 'missing' } })
  expect(screen.getByText('No competencies match these filters.')).toBeTruthy()
})

it('shows pathway connections and navigates to a connected destination', async () => {
  const navigate = vi.fn()
  mock.rpc.mockResolvedValue({ data: { nodes: [ { id: 'stage', title: 'My stage', node_type: 'education_stage' }, { id: 'career', title: 'Career learning', node_type: 'career_path', route_key: 'skill_academy' } ], edges: [{ from: 'stage', to: 'career', relationship: 'prepares_for', rationale: 'Build skills before applying.' }] } })
  render(<LearnerTools view="graph" onBack={vi.fn()} onNavigate={navigate} />)
  await screen.findByText('Build skills before applying.')
  fireEvent.click(screen.getAllByRole('button', { name: 'Open Skill Academy' })[0])
  expect(navigate).toHaveBeenCalledWith('academy')
  fireEvent.change(screen.getByLabelText('Pathway type'), { target: { value: 'career_path' } })
  expect(screen.queryByText('My stage')).toBeNull()
})

it('does not render a route supplied as an external URL or enable financial routes', () => {
  expect(learnerRoute('https://example.com')).toBeNull()
  expect(learnerRoute('wallet')).toBeNull()
  expect(learnerRoute('earn_work')).toBeNull()
  expect(learnerRoute('does-not-exist')).toBeNull()
  expect(learnerRoute('constructor')).toBeNull()
  expect(learnerRoute('__proto__')).toBeNull()
  expect(learnerRoute('career_passport')).toBe('passport')
})

it('does not spin forever when a section returns no data', async () => {
  mock.rpc.mockResolvedValue({ data: null })
  render(<LearnerTools view="mastery" onBack={vi.fn()} />)
  expect((await screen.findByRole('alert')).textContent).toContain('returned no data')
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
})

it('requires active goal replacement confirmation and submits the selected career path', async () => {
  mock.rpc.mockImplementation(async (name: string) => name === 'get_my_mela_next' ? { data: { audience: { stage_key: 'university' }, active_plan: { id: 'p', goal_title: 'Current goal' }, steps: [], career_paths: [{ id: 'path', title: 'Engineering', description: 'Build systems.' }] } } : { error: null })
  render(<LearnerTools view="next" onBack={vi.fn()} />)
  fireEvent.change(await screen.findByLabelText('Goal'), { target: { value: 'Become an engineer' } })
  fireEvent.change(screen.getByLabelText('Goal type'), { target: { value: 'career_path' } })
  fireEvent.change(screen.getByLabelText('Career pathway'), { target: { value: 'path' } })
  expect((screen.getByRole('button', { name: 'Save goal' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Save goal' }))
  await screen.findByText('Your goal and transition plan have been saved.')
  expect(mock.rpc).toHaveBeenCalledWith('set_my_mela_next_goal', expect.objectContaining({ p_career_path_id: 'path' }))
})

function stepWrite(result: unknown) {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue(result) }
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query)
  mock.from.mockReturnValue(query)
  return query
}
it('persists step completion scoped to its plan and restores server-confirmed progress', async () => {
  mock.rpc.mockResolvedValue({ data: { audience: { stage_key: 'school_1_6' }, active_plan: { id: 'plan' }, steps: [{ id: 'step', title: 'Practice', status: 'not_started', route_key: 'practice' }] } })
  const query = stepWrite({ data: { id: 'step', status: 'completed', completed_at: '2026-10-09' } })
  render(<LearnerTools view="next" onBack={vi.fn()} onNavigate={vi.fn()} />)
  const input = await screen.findByLabelText('Step progress: Practice')
  fireEvent.change(input, { target: { value: 'completed' } })
  await screen.findByText('Plan progress saved.')
  expect(query.eq).toHaveBeenCalledWith('plan_id', 'plan')
  expect(query.eq).toHaveBeenCalledWith('id', 'step')
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed', completed_at: expect.any(String) }))
  expect((input as HTMLSelectElement).value).toBe('completed')
})
it('preserves step status after a rejected save and permits retry', async () => {
  mock.rpc.mockResolvedValue({ data: { audience: { stage_key: 'school_1_6' }, active_plan: { id: 'plan' }, steps: [{ id: 'step', title: 'Practice', status: 'not_started' }] } })
  const query = stepWrite({ error: { message: 'Permission denied' } })
  render(<LearnerTools view="next" onBack={vi.fn()} />)
  const input = await screen.findByLabelText('Step progress: Practice')
  fireEvent.change(input, { target: { value: 'completed' } })
  await screen.findByText('Permission denied')
  expect((input as HTMLSelectElement).value).toBe('not_started')
  expect((input as HTMLSelectElement).disabled).toBe(false)
  query.single.mockResolvedValueOnce({ data: { id: 'step', status: 'in_progress' } })
  fireEvent.change(input, { target: { value: 'in_progress' } })
  await screen.findByText('Plan progress saved.')
})
it('rejects no-row updates rather than displaying a false saved status', async () => {
  stepWrite({ data: null, error: null })
  await expect(saveTransitionStep('plan', 'step', 'completed')).rejects.toThrow('could not be saved')
})
