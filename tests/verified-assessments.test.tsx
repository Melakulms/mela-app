import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VerifiedAssessments from '../src/pages/VerifiedAssessments'

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  invoke: vi.fn(),
  getUserMedia: vi.fn(),
  stop: vi.fn(),
}))

vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mock.getUser },
    from: mock.from,
    rpc: mock.rpc,
    functions: { invoke: mock.invoke },
  },
}))

function queryBuilder(data: unknown) {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    single: vi.fn(async () => ({ data, error: null })),
    then: (resolve: any, reject: any) => Promise.resolve({ data, error: null }).then(resolve, reject),
  }
  return builder
}

beforeEach(() => {
  vi.clearAllMocks()
  mock.getUser.mockResolvedValue({ data: { user: { id: 'learner-1' } }, error: null })
  mock.invoke.mockResolvedValue({ data: { ok: true }, error: null })
  mock.stop.mockReset()
  mock.getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: mock.stop }] })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: mock.getUserMedia },
  })

  const assessment = {
    id: 'assessment-1', title: 'Verified readiness', description: 'A verified assessment', instructions: null,
    duration_minutes: 30, pass_score: 75, question_count: 1, max_attempts: 3, is_proctored: true,
  }
  const createdAttempt = {
    id: 'attempt-1', assessment_id: 'assessment-1', attempt_no: 1, status: 'in_progress',
    started_at: new Date().toISOString(), submitted_at: null, duration_seconds: null, score: null,
    passed: null, proctored: true, proctor_status: 'pending',
  }

  mock.from.mockImplementation((table: string) => {
    if (table === 'skill_assessments') return queryBuilder([assessment])
    if (table === 'assessment_attempts') {
      const builder = queryBuilder([])
      builder.insert = vi.fn(() => queryBuilder(createdAttempt))
      return builder
    }
    if (table === 'assessment_responses') {
      const builder = queryBuilder([])
      builder.upsert = vi.fn(async () => ({ data: null, error: null }))
      return builder
    }
    return queryBuilder([])
  })

  mock.rpc.mockImplementation(async (name: string) => {
    if (name === 'has_current_policy_acknowledgement') return { data: false, error: null }
    if (name === 'record_my_policy_acknowledgement') return { data: { accepted: true }, error: null }
    if (name === 'get_assessment_attempt_questions_localized') {
      return { data: [{ question_id: 'question-1', prompt: 'Choose A', choices: ['A', 'B'] }], error: null }
    }
    if (name === 'submit_my_assessment_attempt') {
      return { data: { id: 'attempt-1', status: 'review_required', score: 100, passed: true, proctor_status: 'pending', duration_seconds: 10, submitted_at: new Date().toISOString() }, error: null }
    }
    return { data: null, error: null }
  })
})

afterEach(cleanup)

it('requires explicit proctor consent and submits through the authoritative assessment RPC', async () => {
  render(<VerifiedAssessments onBack={vi.fn()} />)
  await screen.findByText('Verified readiness')
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))

  const start = screen.getByRole('button', { name: 'Start assessment' }) as HTMLButtonElement
  expect(start.disabled).toBe(true)
  fireEvent.click(screen.getByRole('checkbox'))
  expect(start.disabled).toBe(false)
  fireEvent.click(start)

  expect(await screen.findByText('1. Choose A')).toBeTruthy()
  expect(mock.getUserMedia).toHaveBeenCalledWith({ video: true, audio: false })
  expect(mock.stop).toHaveBeenCalledTimes(1)
  expect(mock.rpc).toHaveBeenCalledWith('record_my_policy_acknowledgement', expect.objectContaining({ p_policy_key: 'proctoring', p_accept: true }))

  fireEvent.click(screen.getByRole('radio', { name: 'A' }))
  fireEvent.click(screen.getByRole('button', { name: 'Submit assessment' }))

  await waitFor(() => expect(mock.rpc).toHaveBeenCalledWith('submit_my_assessment_attempt', { p_attempt_id: 'attempt-1' }))
  expect(await screen.findByText(/Proctor review is pending/)).toBeTruthy()
})

it('blocks a proctored assessment when camera permission fails', async () => {
  mock.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'))
  render(<VerifiedAssessments onBack={vi.fn()} />)
  await screen.findByText('Verified readiness')
  fireEvent.click(screen.getByRole('button', { name: 'Open' }))
  fireEvent.click(screen.getByRole('checkbox'))
  fireEvent.click(screen.getByRole('button', { name: 'Start assessment' }))

  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Camera permission is required')
  expect(screen.queryByText('1. Choose A')).toBeNull()
})
