type Item = { number: number; title: string; detail: string; anchor?: string; scope?: string }
const sections: Item[] = [
  { number:1,title:'Mentorship Home',detail:'Personalized overview and next steps',anchor:'mentorship-home' },
  { number:2,title:'Find a Mentor',detail:'Search verified and active mentors',anchor:'mentor-directory' },
  { number:3,title:'Mentorship Categories',detail:'Explore areas of guidance',anchor:'mentor-directory' },
  { number:4,title:'Mentor Profiles',detail:'Experience, languages, and weekly hours',anchor:'mentor-directory' },
  { number:5,title:'Smart Matching',detail:'Interest-based suggestions',anchor:'mentorship-home' },
  { number:6,title:'Mentorship Requests',detail:'Track requests and responses',anchor:'mentorship-journey' },
  { number:7,title:'Booking and Scheduling',detail:'Check scheduled appointments',anchor:'mentorship-journey' },
  { number:8,title:'Live Mentorship',detail:'In-app calls are not activated',anchor:'mentorship-live' },
  { number:9,title:'My Mentorship',detail:'Learning goals and personal plans',anchor:'mentorship-goals' },
  { number:10,title:'Resources',detail:'Approved preparation guides',anchor:'mentorship-library' },
  { number:11,title:'Assignments',detail:'Submit and receive feedback',anchor:'mentorship-assignments' },
  { number:12,title:'Progress',detail:'Track real learning activities',anchor:'mentorship-progress' },
  { number:13,title:'Group Mentorship',detail:'View approved group programs',anchor:'mentorship-groups' },
  { number:14,title:'Mentor Workspace',detail:'For approved mentor accounts',scope:'Mentor account' },
  { number:15,title:'Guardian and Safety',detail:'Safeguarding and consent',anchor:'mentorship-safety' },
  { number:16,title:'Administration',detail:'For authorized administrators only',scope:'Central Admin' },
]
export default function MentorshipSectionDirectory() {
  return <nav className="empty-panel" aria-label="All 16 MELA mentorship sections" style={{ textAlign:'left' }}>
    <h2>Explore all 16 mentorship sections</h2>
    <p>Open the available tools below. Some services require an approved mentor or a safeguarding review before they can accept users.</p>
    <div className="module-grid">
      {sections.map((item) => <div className="module-card" key={item.number}
        style={{ background:'var(--surface)',border:'1px solid var(--line)',padding:'.85rem' }}>
        <span className="muted">{String(item.number).padStart(2,'0')}</span>
        <h3 style={{ fontSize:'1rem',margin:'.25rem 0' }}>{item.title}</h3>
        <p className="muted" style={{ fontSize:'.82rem' }}>{item.detail}</p>
        {item.anchor ? <a href={'#'+item.anchor} className="btn btn-secondary">Open section</a>
          : <span className="pill">{item.scope}</span>}
      </div>)}
    </div>
  </nav>
}
