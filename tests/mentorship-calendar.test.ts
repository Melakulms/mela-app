import { describe, expect, it } from 'vitest'
import { mentorshipCalendarEvent, sessionEndTime } from '../src/lib/mentorship-calendar'
import type { MentorshipSession } from '../src/lib/mentorship'
const session = {id:'s1',scheduled_at:'2099-01-01T13:00:00+03:00',duration_min:45,status:'scheduled',notes:'PRIVATE DISCUSSION',call_room_id:'PRIVATE URL'} as MentorshipSession
const now = new Date('2026-10-27T10:00:00Z')
describe('Mentorship calendar export', () => {
  it('preserves the appointment instant across timezones without exporting notes or rooms', () => {
    const event = mentorshipCalendarEvent(session,now)
    expect(event).toContain('DTSTART:20990101T100000Z\r\nDTEND:20990101T104500Z')
    expect(event).toContain('CLASS:PRIVATE')
    expect(event).not.toContain('PRIVATE DISCUSSION')
    expect(event).not.toContain('PRIVATE URL')
    expect(event.split('\r\n').every(line=>line.length<=75)).toBe(true)
  })
  it.each(['cancelled','completed','pending'])('does not export a %s appointment', status => {
    expect(()=>mentorshipCalendarEvent({...session,status},now)).toThrow('upcoming confirmed')
  })
  it('rejects malformed durations, dates, past appointments and injected event identifiers', () => {
    for (const duration_min of [null,0,181,NaN]) expect(()=>mentorshipCalendarEvent({...session,duration_min},now)).toThrow()
    expect(()=>mentorshipCalendarEvent({...session,scheduled_at:'bad'},now)).toThrow()
    expect(()=>mentorshipCalendarEvent({...session,scheduled_at:'2020-01-01'},now)).toThrow()
    expect(()=>mentorshipCalendarEvent({...session,id:'s1\r\nATTENDEE:other'},now)).toThrow()
  })
  it('uses the full session duration for completion eligibility', () => {
    expect(sessionEndTime(session)).toBe(new Date('2099-01-01T10:45:00Z').getTime())
  })
})
