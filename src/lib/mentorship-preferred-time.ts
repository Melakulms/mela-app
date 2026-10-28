import type { MentorAvailability } from './mentorship'

// Advisory guidance only. The server never books from a preferred time, and the
// mentor must still schedule an available session. Times are compared in the
// mentor's published time zone, using the same weekday convention as the database
// (0 = Sunday).
export type PreferredTimeGuidance =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'inside'; slot: MentorAvailability }
  | { status: 'outside' }

const WEEKDAY_BY_SHORT: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function localPartsIn(date: Date, timeZone: string): { weekday: number; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? ''
  const weekday = WEEKDAY_BY_SHORT[get('weekday')]
  const hour = Number(get('hour'))
  const minute = Number(get('minute'))
  if (weekday === undefined || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error('Unreadable local time')
  }
  return { weekday, minutes: hour * 60 + minute }
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

/**
 * @param instant the learner's chosen moment (convert a datetime-local value with new Date(value) at the call site)
 * @param slots the mentor's published weekly availability
 * @param startWindowMinutes minimum time that must remain inside a slot (default 30)
 */
export function preferredTimeGuidance(
  instant: Date | null,
  slots: MentorAvailability[],
  startWindowMinutes = 30,
): PreferredTimeGuidance {
  if (!instant) return { status: 'none' }
  if (!Number.isFinite(instant.getTime())) return { status: 'invalid' }
  if (!slots.length) return { status: 'none' }
  for (const slot of slots) {
    try {
      const local = localPartsIn(instant, slot.timezone)
      const start = toMinutes(slot.start_time)
      const end = toMinutes(slot.end_time)
      if (local.weekday === slot.weekday && local.minutes >= start && local.minutes + startWindowMinutes <= end) {
        return { status: 'inside', slot }
      }
    } catch {
      // A malformed stored zone must not reveal or block anything; skip that slot.
    }
  }
  return { status: 'outside' }
}
