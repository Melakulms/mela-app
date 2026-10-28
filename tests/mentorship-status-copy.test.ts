import { describe, expect, it } from 'vitest'
import {
  mentorshipRequestStatus, mentorshipSessionStatus, mentorshipRequestNextStep,
} from '../src/lib/mentorship-status-copy'

describe('Mentorship learner-facing status copy', () => {
  it('explains that accepting a request is not a confirmed appointment', () => {
    expect(mentorshipRequestStatus('accepted','en')).toMatch(/booking not yet confirmed/i)
    expect(mentorshipRequestNextStep('accepted','en')).toMatch(/duration/i)
    expect(mentorshipSessionStatus('scheduled','en')).toBe('Booking confirmed')
  })
  it('localizes Amharic statuses and next actions', () => {
    expect(mentorshipRequestStatus('pending','am')).toContain('ምላሽ')
    expect(mentorshipRequestNextStep('declined','am')).toContain('አማካሪ')
    expect(mentorshipSessionStatus('cancelled','am')).toContain('ተሰርዟል')
  })
  it('never exposes unknown raw status values to learners', () => {
    expect(mentorshipRequestStatus('internal_private_state','en')).toBe('Request status unavailable')
    expect(mentorshipSessionStatus('internal_state','am')).not.toContain('internal_state')
  })
})