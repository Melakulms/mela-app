import { useState } from 'react'
import type { MentorshipSession } from '../lib/mentorship'
import { mentorshipCalendarEvent, sessionEndTime } from '../lib/mentorship-calendar'

export default function MentorshipCalendarButton({ session }: { session: MentorshipSession }) {
  const [error, setError] = useState('')
  if (session.status !== 'scheduled' || !Number.isFinite(sessionEndTime(session)) || new Date(session.scheduled_at).getTime() <= Date.now()) return null
  const download = () => {
    let url: string | undefined
    try {
      setError('')
      url = URL.createObjectURL(new Blob([mentorshipCalendarEvent(session)], { type: 'text/calendar;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'mela-mentorship.ics'
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your calendar file could not be downloaded.')
    } finally {
      if (url) { const downloadUrl = url; setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000) }
    }
  }
  return <div>
    <button type="button" className="btn btn-secondary" onClick={download}>Add to my calendar</button>
    <p className="muted">Downloads a private appointment file. Calendar copies do not update automatically; check MELA for cancellations or changes.</p>
    {error && <p role="alert">{error}</p>}
  </div>
}
