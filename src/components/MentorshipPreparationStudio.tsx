import { useEffect } from 'react'
import { useSectionDrilldown } from '../hooks/useSectionDrilldown'
import MentorshipPracticeLab from './MentorshipPracticeLab'
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, Compass, GraduationCap, Handshake, Home, Layers, LockKeyhole, Search, ShieldCheck, Sparkles, Target, Trophy, UserRound, Users } from 'lucide-react'

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

const SECTION_ICONS = [
  Home, Search, Layers, UserRound, Sparkles, Handshake, CalendarDays, ShieldCheck,
  Target, BookOpen, ClipboardList, Trophy, Users, GraduationCap, ShieldCheck, LockKeyhole,
] as const

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
    <section className="mela-section-focus" aria-label={`Mentorship section ${activeSection} practice`}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">Section {activeSection} of 16 · Practice</span>
          <h2>{MENTORSHIP_SECTION_CARDS[activeSection - 1].title}</h2>
        </div>
        <button type="button" className="btn btn-secondary" onClick={closeSection}>
          Back to 16 sections
        </button>
      </div>
      <p>{MENTORSHIP_SECTION_CARDS[activeSection - 1].summary}</p>
      <p className="mela-practice-disclosure" role="note">
        Practice only — this exercise is not a real mentor request, session booking,
        certificate or administrator approval. Do not enter confidential information.
      </p>
      <MentorshipPracticeLab key={activeSection} section={activeSection} />
    </section>
  )

  return (
    <section aria-labelledby="mentorship-section-list-heading" className="mela-mentor-index">
      <div className="mela-section-intro">
        <span className="eyebrow">LEARN · CONNECT · GROW</span>
        <h2 id="mentorship-section-list-heading">MELA Mentorship — 16 Sections</h2>
        <p>Choose a card to enter its own guided exercise. Use Back to 16 sections to return.</p>
      </div>
      <p className="mela-practice-disclosure" role="note">
        These cards open learning exercises only. Live mentor matching, booking,
        guardian approval, certificates, private mentor tools and administrator
        actions require separately verified accounts and safe launch checks.
        Do not enter names, passwords, contact details or confidential documents.
      </p>
      <div className="mela-subsection-grid" aria-label="16 mentorship section cards">
        {MENTORSHIP_SECTION_CARDS.map((card, index) => {
          const number = index + 1
          const Icon = SECTION_ICONS[index]
          return (
            <button key={card.title} type="button" className="mela-subsection-card"
              aria-label={`Open practice: ${card.title}`}
              onClick={() => openSection(String(number))}>
              <span className="mela-subsection-icon" aria-hidden="true"><Icon size={25} /></span>
              <span className="mela-subsection-number">Section {number} · Practice</span>
              <strong className="mela-subsection-title">{card.title}</strong>
              <span className="mela-subsection-description">{card.summary}</span>
              <span className="mela-subsection-action" aria-hidden="true">
                Open practice <ArrowRight size={19} />
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
