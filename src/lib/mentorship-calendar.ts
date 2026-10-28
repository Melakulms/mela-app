import type { MentorshipSession } from './mentorship'

export function sessionEndTime(session: MentorshipSession): number {
  const duration = session.duration_min
  if (!Number.isInteger(duration) || duration === null || duration < 15 || duration > 180) return NaN
  return new Date(session.scheduled_at).getTime() + duration * 60_000
}

// No names, contact details, discussion topics or private notes leave MELA.
export function mentorshipCalendarEvent(session: MentorshipSession, now = new Date()): string {
  const start = new Date(session.scheduled_at)
  const end = sessionEndTime(session)
  if (session.status !== 'scheduled' || !Number.isFinite(end) || start.getTime() <= now.getTime()) {
    throw new Error('Only a valid upcoming confirmed appointment can be added to your calendar.')
  }
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(session.id)) throw new Error('Invalid appointment identifier.')
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MELA//Mentorship//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:${session.id}@mentorship.mela`, `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(end))}`,
    'SUMMARY:MELA mentorship appointment',
    'DESCRIPTION:Check MELA for current appointment status and approved arrangements.',
    'CLASS:PRIVATE', 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR', '',
  ].map(line => {
    // All exported fields are ASCII; fold at 75 octets for calendar clients.
    const parts: string[] = []
    while (line.length > 75) { parts.push(line.slice(0, 75)); line = ' ' + line.slice(75) }
    parts.push(line)
    return parts.join('\r\n')
  }).join('\r\n')
}
