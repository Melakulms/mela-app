import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isValidAvailabilitySlot, WEEKDAYS } from '../lib/mentor-discovery'
import type { MentorAvailability } from '../lib/mentorship'

export default function MentorAvailabilityManager() {
  const [slots, setSlots] = useState<MentorAvailability[]>([])
  const [weekday, setWeekday] = useState(1)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const deviceTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const timezones = Array.from(new Set(['Africa/Addis_Ababa', deviceTimezone, 'UTC'].filter(Boolean)))
  const [timezone, setTimezone] = useState('Africa/Addis_Ababa')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [availabilityVerified, setAvailabilityVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  const lock = useRef(false)
  const readSequence = useRef(0)

  const load = useCallback(async () => {
    const readId = ++readSequence.current
    setError('')
    setAvailabilityVerified(false)
    // A previous account's cached weekly slots must never be used to check
    // availability after a failed refresh or a changed authentication session.
    setSlots([])
    setLoading(true)
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Sign in again to manage your availability.')
      const { data, error: fetchError } = await supabase
        .from('mentor_availability')
        .select('id,weekday,start_time,end_time,timezone')
        .eq('mentor_id', auth.user.id)
        .order('weekday', { ascending: true })
      if (fetchError) throw new Error(fetchError.message)
      if (readId === readSequence.current) {
        setSlots((data ?? []).filter((slot) => Number.isInteger(slot.weekday) &&
          typeof slot.id === 'string' && typeof slot.start_time === 'string' &&
          typeof slot.end_time === 'string' && typeof slot.timezone === 'string') as MentorAvailability[])
        setAvailabilityVerified(true)
      }
    } catch (cause) {
      if (readId === readSequence.current) setError(cause instanceof Error ? cause.message : 'Could not load availability.')
    } finally {
      if (readId === readSequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => { readSequence.current += 1 }
  }, [load, revision])

  const mutate = async (action: () => Promise<void>) => {
    if (lock.current || loading || !availabilityVerified) {
      if (!loading && !availabilityVerified) setError('Weekly hours could not be verified. Refresh before editing availability.')
      return
    }
    lock.current = true
    setBusy(true)
    setNotice('')
    setError('')
    try {
      await action()
      setNotice('Availability updated. Learners can see your published hours.')
      setRevision((current) => current + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update availability.')
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  const add = () => {
    if (loading || !availabilityVerified) return
    if (!isValidAvailabilitySlot(weekday, start, end)) {
      setError('Select a valid weekday and an ending time later than the start time.')
      return
    }
    if (slots.some((slot) => slot.weekday === weekday && slot.timezone === timezone &&
      start < slot.end_time.slice(0, 5) && end > slot.start_time.slice(0, 5))) {
      setError('This window overlaps an existing availability window.')
      return
    }
    void mutate(async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Sign in again to manage availability.')
      const { error: insertError } = await supabase.from('mentor_availability').insert({
        mentor_id: auth.user.id, weekday, start_time: start, end_time: end,
        timezone, active: true,
      })
      if (insertError) throw new Error(insertError.message)
    })
  }

  const remove = (id: string) => {
    if (loading || !availabilityVerified || !slots.some(slot => slot.id === id)) return
    void mutate(async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Sign in again to manage availability.')
      const { data: deleted, error: deleteError } = await supabase.from('mentor_availability')
        .delete().eq('id', id).eq('mentor_id', auth.user.id).select('id')
      if (deleteError) throw new Error(deleteError.message)
      if (!deleted?.length) throw new Error('This weekly window was not removed. Refresh your hours and retry.')
    })
  }

  return <section className="empty-panel" style={{ textAlign: 'left' }}>
    <h2>My mentoring availability</h2>
    <p>Publish weekly time windows before booking sessions. Appointments must fit entirely inside an active weekly window in its selected time zone; overlapping appointments are rejected. A request is not a confirmed booking.</p>
    {error && <div role="alert" className="banner banner-error">{error}</div>}
    {notice && <p role="status" className="banner banner-info">{notice}</p>}
    {!loading && !availabilityVerified && <div role="status" className="banner banner-info">
      Your published weekly hours could not be verified. Editing is paused to prevent overlapping or duplicate windows.
      <button type="button" className="btn btn-secondary" onClick={() => setRevision(value => value + 1)}>Retry weekly hours</button>
    </div>}
    {loading ? <p role="status">Loading your availability…</p> : !availabilityVerified ? null : slots.length === 0
      ? <p>No weekly hours published yet.</p>
      : <ul>{slots.map((slot) => <li key={slot.id} style={{ marginBottom: '.5rem' }}>
        {WEEKDAYS[slot.weekday] ?? 'Day'} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} ({slot.timezone}){' '}
        <button type="button" className="btn btn-secondary" disabled={busy || loading || !availabilityVerified} onClick={() => remove(slot.id)} aria-label={`Remove ${WEEKDAYS[slot.weekday]} availability`}>Remove</button>
      </li>)}</ul>}
    <div className="module-grid">
      <div className="field"><label htmlFor="availability-weekday">Day</label><select id="availability-weekday" value={weekday} disabled={busy} onChange={(event) => setWeekday(Number(event.target.value))}>{WEEKDAYS.map((day, index) => <option value={index} key={day}>{day}</option>)}</select></div>
      <div className="field"><label htmlFor="availability-zone">Time zone</label><select id="availability-zone" value={timezone} disabled={busy} onChange={(event) => setTimezone(event.target.value)}>{timezones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}</select></div>
      <div className="field"><label htmlFor="availability-start">From</label><input id="availability-start" type="time" value={start} disabled={busy} onChange={(event) => setStart(event.target.value)} /></div>
      <div className="field"><label htmlFor="availability-end">To</label><input id="availability-end" type="time" value={end} disabled={busy} onChange={(event) => setEnd(event.target.value)} /></div>
    </div>
    <button type="button" className="btn btn-primary" disabled={busy || loading || !availabilityVerified} onClick={add}>{busy ? 'Saving…' : 'Add weekly hours'}</button>
  </section>
}
