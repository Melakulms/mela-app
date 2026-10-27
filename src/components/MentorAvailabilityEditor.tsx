import { useEffect, useRef, useState } from 'react'
import { addMentorAvailability, fetchOwnAvailability, removeMentorAvailability, type MentorAvailability } from '../lib/mentor-availability'
import { WEEKDAYS } from '../lib/mentor-discovery'
export default function MentorAvailabilityEditor() {
  const [slots, setSlots] = useState<MentorAvailability[]>([])
  const [day, setDay] = useState(1), [start, setStart] = useState('09:00'), [end, setEnd] = useState('10:00')
  const [zone, setZone] = useState('Africa/Addis_Ababa')
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [revision, setRevision] = useState(0)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setLoadFailed(false)
    fetchOwnAvailability().then(data => { if (active) setSlots(data) }).catch(e => { if (active) { setError(e?.message ?? 'Could not load availability.'); setLoadFailed(true) } }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice('Availability saved.') } catch (e) { setError(e instanceof Error ? e.message : 'Could not save availability. Please retry.') }
    finally { lock.current = false; setBusy(false) }
  }
  return <section className="mentorship-panel">
    <h2>My weekly availability</h2><p>Publish times when learners may request a session. These are recurring preferences, not confirmed bookings. Times use a 24-hour clock.</p>
    {error && <p className="banner banner-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <button className="btn btn-secondary" disabled={busy || loading} onClick={() => setRevision(r => r + 1)}>Refresh availability</button>
    {loading ? <p role="status">Loading availability…</p> : <>
      {!slots.length && <p>No weekly times published.</p>}
      <ul>{slots.map(s => <li key={s.id}>{WEEKDAYS[s.weekday]} · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} · {s.timezone}{' '}<button className="btn btn-secondary" disabled={busy} aria-label={`Remove ${WEEKDAYS[s.weekday]} ${s.start_time.slice(0, 5)}`} onClick={() => void run(async () => { await removeMentorAvailability(s.id); setSlots(current => current.filter(row => row.id !== s.id)) })}>Remove</button></li>)}</ul>
      <form onSubmit={e => { e.preventDefault(); void run(async () => { const row = await addMentorAvailability(day, start, end, zone); setSlots(current => [...current, row].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time))) }) }}>
        <fieldset disabled={busy || loadFailed}><legend>Add a weekly time</legend>
          <div className="field"><label htmlFor="availability-day">Weekday</label><select id="availability-day" value={day} onChange={e => setDay(Number(e.target.value))}>{WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
          <div className="mentorship-columns"><div className="field"><label htmlFor="availability-start">Start time</label><input id="availability-start" type="time" required value={start} onChange={e => setStart(e.target.value)} /></div><div className="field"><label htmlFor="availability-end">End time</label><input id="availability-end" type="time" required value={end} onChange={e => setEnd(e.target.value)} /></div></div>
          <div className="field"><label htmlFor="availability-zone">Time zone</label><input id="availability-zone" required value={zone} onChange={e => setZone(e.target.value)} placeholder="Africa/Addis_Ababa" /></div>
          <button className="btn btn-primary" type="submit">{busy ? 'Saving…' : 'Publish availability'}</button>
        </fieldset>
      </form>
    </>}
  </section>
}
