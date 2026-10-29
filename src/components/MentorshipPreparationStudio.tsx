import { useState } from 'react'
import MentorshipPracticeLab from './MentorshipPracticeLab'

export const PREPARATION_SECTIONS = [
  'Mentorship Home', 'Find a Mentor', 'Mentorship Categories', 'Mentor Profiles',
  'Smart Mentor Match', 'Mentorship Requests', 'Booking & Scheduling',
  'Safe Session Preparation', 'My Mentorship', 'Resource Library',
  'Assignments', 'Progress & Achievements', 'Group Mentorship',
  'Mentor Workspace', 'Guardian & Safety', 'Central Admin',
] as const

/** Practice-only companion for the production learning guides.
 * No private mentorship API, storage or role/eligibility action is invoked. */
export default function MentorshipPreparationStudio() {
  const [section, setSection] = useState(1)
  return (
    <details className="empty-panel" style={{ textAlign: 'left', borderTop: '4px solid #167b89' }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Explore the 16 mentorship preparation tools</summary>
      <p>Plan what to learn, choose helpful questions and create a personal practice worksheet for each area.</p>
      <p className="muted" role="note">
        These are preparation exercises, not live mentor matching, session booking,
        guardian approval, certificate issuance or administrator access.
        Nothing is sent to MELA or saved to your account.
        Do not enter names, contact details, passwords or confidential documents.
      </p>
      <div className="field">
        <label htmlFor="mentorship-preparation-section">Choose an area to practise</label>
        <select id="mentorship-preparation-section" value={section}
          onChange={event => setSection(Number(event.target.value))}>
          {PREPARATION_SECTIONS.map((name, index) =>
            <option key={name} value={index + 1}>{index + 1}. {name}</option>
          )}
        </select>
      </div>
      <MentorshipPracticeLab key={section} section={section} />
    </details>
  )
}
