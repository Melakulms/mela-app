import { useEffect, useRef } from 'react'

type Section = {
  number: number
  title: string
  summary: string
  guide: string
  anchor?: string
  access?: string
}
const sections: Section[] = [
  { number:1,title:'Mentorship Home',summary:'Dashboard and personal next steps',guide:'Review your real requests, upcoming sessions and learning goals. Counters may be zero until you begin mentoring.',anchor:'mentorship-home' },
  { number:2,title:'Find a Mentor',summary:'Explore approved mentors',guide:'Search for mentors by field, language and weekly availability. Only independently verified active mentors can appear.',anchor:'mentor-directory' },
  { number:3,title:'Mentorship Categories',summary:'Academic, career and professional guidance',guide:'Choose a guidance category in the Find a Mentor filters. Categories organize verified mentor profiles; they are not new or unreviewed people.',anchor:'mentor-directory' },
  { number:4,title:'Mentor Profiles',summary:'Qualifications, skills and availability',guide:'Open the mentor directory to see published profiles, languages and available times. You can request a real mentor only when your account is eligible.',anchor:'mentor-directory' },
  { number:5,title:'Smart Matching',summary:'Suggested mentors for your goals',guide:'Recommendations use your saved interests and published mentor expertise. Matching is not a safety, identity or eligibility approval.',anchor:'mentorship-home' },
  { number:6,title:'Mentorship Requests',summary:'Track pending and accepted invitations',guide:'Your own requests and mentor responses appear in the journey below. A request does not guarantee a meeting.',anchor:'mentorship-journey' },
  { number:7,title:'Booking and Scheduling',summary:'Confirmed sessions and calendar',guide:'Only an approved mentor can confirm a session. View confirmed times in your journey; no off-platform meeting is implied.',anchor:'mentorship-journey' },
  { number:8,title:'Live Mentorship',summary:'Audio and video safety status',guide:'In-app audio and video are not activated. You can read the safety rules, but cannot start an unmoderated call.',anchor:'mentorship-live',access:'Safety-gated — calls unavailable' },
  { number:9,title:'My Mentorship',summary:'Personal learning goals and plans',guide:'Manage your private goals and learning plan below. Setting a goal does not award verified achievement credit.',anchor:'mentorship-goals' },
  { number:10,title:'Resources',summary:'Mentorship study and preparation guides',guide:'Read published guidance, search by topic and use it to prepare questions. Learning resources do not require a booked session.',anchor:'mentorship-library' },
  { number:11,title:'Assignments',summary:'Tasks, responses and mentor feedback',guide:'Assignments appear when an approved mentor has accepted a mentoring relationship. Without one, the list will be empty.',anchor:'mentorship-assignments' },
  { number:12,title:'Progress',summary:'Your recorded learning activities',guide:'See recorded task submissions, mentor reviews and self-reported goals. Credentials require separate independent review.',anchor:'mentorship-progress' },
  { number:13,title:'Group Mentorship',summary:'Supervised group opportunities',guide:'Browse published groups. Joining currently requires verified adult eligibility and an approved facilitator; no automatic enrollment.',anchor:'mentorship-groups',access:'Eligibility review required to join' },
  { number:14,title:'Mentor Workspace',summary:'Tools for verified professional mentors',guide:'Approved mentors manage requests, availability and assignments in their mentor account. A learner account cannot enter another mentor’s private workspace.',access:'Verified mentor account required' },
  { number:15,title:'Guardian and Safety',summary:'Consent, reporting and safeguarding',guide:'Read guardian rules and open MELA Safety & Privacy to request consent or report a concern. Grade restrictions remain enforced.',anchor:'mentorship-safety' },
  { number:16,title:'Administration',summary:'Credential and safeguarding review',guide:'The Central Admin is a separate application. Only an authorized administrator with required MFA can review mentors, age evidence, groups and reports.',access:'Central Admin MFA required' },
]

export default function MentorshipSectionDirectory({ selected, onSelect }: {
  selected: number | null
  onSelect: (section: number | null) => void
}) {
  const panel = useRef<HTMLElement>(null)
  const section = sections.find(item => item.number === selected)
  useEffect(() => {
    if (section) {
      panel.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
      panel.current?.focus()
    }
  }, [selected])

  return <nav className="empty-panel" aria-label="All 16 MELA mentorship sections" style={{ textAlign:'left' }}>
    {section ? <section ref={panel} tabIndex={-1} aria-label={section.title}>
      <button type="button" className="btn btn-secondary" onClick={() => onSelect(null)}>All mentorship sections</button>
      <h2>{section.number}. {section.title}</h2>
      <p>{section.guide}</p>
      {section.access && <p className="banner banner-info" role="status">{section.access}</p>}
    </section> : <>
      <h2>Explore all 16 mentorship sections</h2>
      <p>Choose a section to open its tools. Sections that need an approved mentor or administrator explain the next step.</p>
      <div className="module-grid">
        {sections.map(item => <article className="module-card" key={item.number}
          style={{ background:'var(--surface)',border:'1px solid var(--line)',padding:'.85rem' }}>
          <span className="muted">{String(item.number).padStart(2,'0')}</span>
          <h3 style={{ fontSize:'1rem',margin:'.25rem 0' }}>{item.title}</h3>
          <p className="muted" style={{ fontSize:'.82rem' }}>{item.summary}</p>
          {item.access && <p className="field-hint">{item.access}</p>}
          <button type="button" className="btn btn-secondary" onClick={() => onSelect(item.number)}>Open {item.title}</button>
        </article>)}
      </div>
    </>}
  </nav>
}
