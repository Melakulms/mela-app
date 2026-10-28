import { beforeEach, expect, it, vi } from 'vitest'

const rpc = vi.hoisted(() => vi.fn())
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc, auth: { getUser: vi.fn() }, from: vi.fn() } }))

import { respondToMentorshipRequest, DECLINE_NOTE_MAX } from '../src/lib/mentorship'
import { mentorshipDeclineReason, DECLINE_REASON_OPTIONS } from '../src/lib/mentorship-status-copy'

beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ error: null }) })

it('sends a decline through the server reason action with a trimmed note', async () => {
  await respondToMentorshipRequest('req-1', 'declined', 'outside_expertise', '  Try a career coach.  ')
  expect(rpc).toHaveBeenCalledWith('respond_mentorship_request_with_reason', {
    p_request_id: 'req-1', p_decision: 'declined', p_reason_code: 'outside_expertise', p_note: 'Try a career coach.',
  })
})

it('does not allow a decline without a known reason code', async () => {
  await expect(respondToMentorshipRequest('req-1', 'declined', '' as never)).rejects.toThrow('Choose a reason')
  await expect(respondToMentorshipRequest('req-1', 'declined', 'made_up' as never)).rejects.toThrow('Choose a reason')
  expect(rpc).not.toHaveBeenCalled()
})

it('rejects an over-long decline note before calling the server', async () => {
  await expect(respondToMentorshipRequest('req-1', 'declined', 'other', 'x'.repeat(DECLINE_NOTE_MAX + 1))).rejects.toThrow('300')
  expect(rpc).not.toHaveBeenCalled()
})

it('accepts a request without sending any decline fields', async () => {
  await respondToMentorshipRequest('req-2', 'accepted', 'other', 'should be ignored')
  expect(rpc).toHaveBeenCalledWith('respond_mentorship_request_with_reason', {
    p_request_id: 'req-2', p_decision: 'accepted', p_reason_code: null, p_note: null,
  })
})

it('surfaces server refusals instead of reporting success', async () => {
  rpc.mockResolvedValueOnce({ error: new Error('request is no longer pending') })
  await expect(respondToMentorshipRequest('req-3', 'declined', 'capacity_full')).rejects.toThrow('no longer pending')
})

it('shows learners readable decline reasons in English and Amharic', () => {
  expect(mentorshipDeclineReason('capacity_full', 'en')).toContain('capacity')
  expect(mentorshipDeclineReason('capacity_full', 'am')).not.toContain('capacity')
  expect(mentorshipDeclineReason(null, 'en')).toBe('')
  expect(mentorshipDeclineReason('unexpected_code', 'en')).toBe('A reason was given')
})

it('offers every reason code in both languages', () => {
  expect(DECLINE_REASON_OPTIONS.en.map(o => o.value)).toEqual(DECLINE_REASON_OPTIONS.am.map(o => o.value))
})
