import { supabase } from './supabase'
export interface MentorAvailability { id: string; mentor_id: string; weekday: number; start_time: string; end_time: string; timezone: string; active: boolean }
async function userId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Please sign in again.')
  return data.user.id
}
export function validateAvailability(weekday: number, start: string, end: string, timezone: string) {
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) throw new Error('Choose a valid weekday.')
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start >= end) throw new Error('End time must be later than start time on the same day.')
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format() } catch { throw new Error('Choose a valid time zone.') }
}
export async function fetchOwnAvailability(): Promise<MentorAvailability[]> {
  const id = await userId()
  const { data, error } = await supabase.from('mentor_availability').select('id,mentor_id,weekday,start_time,end_time,timezone,active').eq('mentor_id', id).eq('active', true).order('weekday').order('start_time')
  if (error) throw error
  return data ?? []
}
export async function addMentorAvailability(weekday: number, start: string, end: string, timezone: string): Promise<MentorAvailability> {
  validateAvailability(weekday, start, end, timezone)
  const id = await userId()
  const { data, error } = await supabase.from('mentor_availability').insert({ mentor_id: id, weekday, start_time: start, end_time: end, timezone, active: true }).select('id,mentor_id,weekday,start_time,end_time,timezone,active').single()
  if (error) throw error
  if (!data) throw new Error('Availability was not saved. Please retry.')
  return data
}
export async function removeMentorAvailability(slotId: string): Promise<void> {
  const id = await userId()
  const { data, error } = await supabase.from('mentor_availability').delete().eq('id', slotId).eq('mentor_id', id).select('id').single()
  if (error) throw error
  if (!data) throw new Error('Availability was not removed. Refresh and retry.')
}
