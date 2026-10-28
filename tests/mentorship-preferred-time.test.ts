import { expect, it } from 'vitest'
import { preferredTimeGuidance } from '../src/lib/mentorship-preferred-time'

// Monday 09:00–12:00 in Addis Ababa (UTC+3, no daylight saving) = 06:00–09:00 UTC.
const addisMonday = { id: 's1', weekday: 1, start_time: '09:00:00', end_time: '12:00:00', timezone: 'Africa/Addis_Ababa' }

it('gives no guidance without a time or without published hours', () => {
  expect(preferredTimeGuidance(null, [addisMonday]).status).toBe('none')
  expect(preferredTimeGuidance(new Date('2099-01-05T07:00:00Z'), []).status).toBe('none')
})

it('rejects an invalid instant', () => {
  expect(preferredTimeGuidance(new Date('nonsense'), [addisMonday]).status).toBe('invalid')
})

it('accepts a time inside published hours, judged in the mentor time zone', () => {
  // 2099-01-05 is a Monday. 07:00Z is 10:00 in Addis Ababa.
  const result = preferredTimeGuidance(new Date('2099-01-05T07:00:00Z'), [addisMonday])
  expect(result.status).toBe('inside')
})

it('flags a time on another weekday as outside the published hours', () => {
  // 2099-01-04 is a Sunday; 07:00Z is still Sunday 10:00 in Addis Ababa.
  expect(preferredTimeGuidance(new Date('2099-01-04T07:00:00Z'), [addisMonday]).status).toBe('outside')
})

it('flags a time before the published start as outside', () => {
  // 05:00Z is 08:00 in Addis Ababa, before the 09:00 start.
  expect(preferredTimeGuidance(new Date('2099-01-05T05:00:00Z'), [addisMonday]).status).toBe('outside')
})

it('does not count a start that leaves less than 30 minutes before the slot ends', () => {
  // 11:45 Addis = 08:45Z: starts inside the slot but only 15 minutes remain.
  expect(preferredTimeGuidance(new Date('2099-01-05T08:45:00Z'), [addisMonday]).status).toBe('outside')
})

it('accepts a start exactly 30 minutes before the slot ends', () => {
  // 11:30 Addis = 08:30Z.
  expect(preferredTimeGuidance(new Date('2099-01-05T08:30:00Z'), [addisMonday]).status).toBe('inside')
})
