import { useEffect } from 'react'
import { useSectionDrilldown } from '../hooks/useSectionDrilldown'
import MentorshipPracticeLab from './MentorshipPracticeLab'

export const MENTORSHIP_SECTION_CARDS = [
  { title: 'Mentorship Home', summary: 'Set a learning or career goal and choose your next step.' },
  { title: 'Find a Mentor', summary: 'Prepare useful search terms for a verified mentor.' },
  { title: 'Mentorship Categories', summary: 'Explore academic, career, scholarship and skills guidance.' },
  { title: 'Mentor Profiles', summary: 'Learn what qualifications and experience to check.' },
  { title: 'Smart Mentor Match', summary: 'Describe interests and the help you want.' },
  { title: 'Mentorship Requests', summary: 'Draft a clear, respectful mentorship request.' },
  { title: 'Booking & Scheduling', summary: 'Plan questions and a preferred future session time.' },
  { title: 'Safe Session Preparation', summary: 'Prepare safely without activating video or recording.' },
  { title: 'My Mentorship', summary: 'Create a weekly learning and improvement plan.' },
  { title: 'Resource Library', summary: 'Reflect on a guide and put what you learned into action.' },
  { title: 'Assignments', summary: 'Practise responding to a learning assignment.' },
  { title: 'Progress & Achievements', summary: 'Reflect on progress without claiming a certificate.' },
  { title: 'Group Mentorship', summary: 'Plan how to learn in a supervised group.' },
  { title: 'Mentor Workspace', summary: 'Prepare a teaching plan; private tools require verification.' },
  { title: 'Guardian & Safety', summary: 'Review privacy, safeguarding and consent rules.' },
  { title: 'Central Admin', summary: 'Understand how qualified administrators review requests.' },
] as const

export const PREPARATION_SECTIONS = MENTORSHIP_SECTION_CARDS.map(card => card.title)

/** Always-visible public mentorship section cards.
 * Every card opens local practice ONLY: this component has no data access,
 * persistence, registration bypass, role assumptions or approval actions.
 */
export default function MentorshipPreparationStudio({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const [section, openSection, closeSection] = useSectionDrilldown('section')
  const parsed = Number(section)
  const activeSection = Number.isInteger(parsed) && parsed >= 1 && parsed <= MENTORSHIP_SECTION_CARDS.length ? parsed : null
  useEffect(() => { onOpenChange?.(activeSection !== null) }, [activeSection, onOpenChange])

  // A selected card becomes its own focused screen; the complete index is hidden.
  if (activeSection !== null) return (
    <section className="empty-panel" aria-label={`Mentorship section ${activeSection} practice`} style={{ textAlign: 'left' }}>
      <div className="section-heading">
        <div><span className="eyebrow">Section {activeSection} of 16</span><h2>{MENTORSHIP_SECTION_CARDS[activeSection - 1].title}</h2></div>
        <button type="button" className="btn btn-secondary" onClick={closeSection}>Back to 16 sections</button>
      </div>
      <p>{MENTORSHIP_SECTION_CARDS[activeSection - 1].summary}</p>
      <p className="muted">This is a local practice exercise, not a real mentor request, session booking or administrator approval. Do not enter confidential information.</p>
      <MentorshipPracticeLab key={activeSection} section={activeSection} />
    </section>
  )

  return (
    <section aria-labelledby="mentorship-section-list-heading" className="empty-panel"
      style={{ textAlign: 'left', borderTop: '4px solid #167b89' }}>
      <h2 id="mentorship-section-list-heading">MELA Mentorship — 16 Sections</h2>
      <p>Choose a section to open its own practice screen. Use Back to 16 sections to choose another.</p>
      <p className="muted" role="note">
        These cards open learning exercises only. Live mentor matching, booking,
        guardian approval, certificates, private mentor tools and administrator
        actions still require separately verified accounts and safe launch checks.
        Do not enter names, passwords, contact details or confidential documents.
      </p>
      <div className="module-grid" aria-label="16 mentorship section cards"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 185px), 1fr))', gap: '.8rem', marginTop: '1rem' }}>
        {MENTORSHIP_SECTION_CARDS.map((card, index) => {
          const number = index + 1
          const selected = false
          return (
            <button key={card.title} type="button" className="module-card"
              aria-label={`Open practice: ${card.title}`}
              aria-pressed={selected}
              onClick={() => openSection(String(number))}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                gap: '.45rem', padding: '1rem', width: '100%', minHeight: '150px',
                textAlign: 'left', cursor: 'pointer', color: 'var(--ink)',
                background: 'var(--surface)',
                border: selected ? '2px solid #167b89' : '1px solid var(--line)',
                borderRadius: '.85rem',
              }}>
              <span className="pill" style={{ fontWeight: 700 }}>Section {number}</span>
              <strong style={{ fontSize: '1rem', lineHeight: 1.3 }}>{card.title}</strong>
              <span className="muted" style={{ fontSize: '.85rem', lineHeight: 1.45 }}>{card.summary}</span>
              <span style={{ fontSize: '.78rem', fontWeight: 650, color: 'var(--ink)', marginTop: 'auto' }}>
                {selected ? 'Practice selected' : 'Open practice'}
              </span>
            </button>
          )
        })}
      </div>

    </section>
  )
}
