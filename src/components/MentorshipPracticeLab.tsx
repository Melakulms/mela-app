import { useState } from 'react'

type Exercise = {
  title: string
  purpose: string
  subject: string
  details: string
  next: string
  checks: [string, string, string]
}

export const PRACTICE_EXERCISES: Record<number, Exercise> = {
  1: { title:'Plan my mentorship journey',purpose:'Set a realistic personal goal before contacting a mentor.',subject:'My learning or career goal',details:'What I have tried so far',next:'My next small step',checks:['I can explain my goal','I know what help I need','I have chosen a realistic next step'] },
  2: { title:'Prepare a mentor search',purpose:'Define useful search terms; use the verified directory above for real results.',subject:'Subject or profession to explore',details:'Language, experience and availability preferences',next:'Search terms to try in the directory',checks:['I chose a field of interest','I will check verified profiles','I will not share private contact details'] },
  3: { title:'Explore mentorship categories',purpose:'Compare areas of guidance without inventing mentor listings.',subject:'Guidance category (e.g. scholarship or engineering)',details:'Why this category matters to me',next:'Question to ask a qualified mentor',checks:['The category fits my goal','I understand categories are not credentials','I will use the verified mentor directory'] },
  4: { title:'Review a mentor profile',purpose:'Prepare questions about a verified mentor without treating a profile as a guarantee.',subject:'Experience or specialization I need',details:'Qualifications and availability to check',next:'A professional question I would ask',checks:['I will check verified status','I will review the published experience','I will follow MELA safety rules'] },
  5: { title:'Improve my matching preferences',purpose:'Create clearer interests to use with real mentor suggestions.',subject:'My strongest learning interest',details:'Skills and subjects I want to develop',next:'The outcome I hope to achieve',checks:['I described my interests','I will compare multiple profiles','I understand matching is not approval'] },
  6: { title:'Draft a mentorship request',purpose:'Rehearse a respectful request. Generating this draft does not send it.',subject:'Request topic',details:'Message explaining my current challenge',next:'Specific help I will ask for',checks:['My request is polite and clear','I did not add phone numbers or secrets','I will send only through an approved account'] },
  7: { title:'Rehearse a session plan',purpose:'Prepare a preferred meeting time. This does not book a session.',subject:'Session topic',details:'Questions and goals for a possible session',next:'What I will prepare beforehand',checks:['A mentor must accept the request','The mentor must confirm a separate booking','I will check published available hours'] },
  8: { title:'Plan a safe session',purpose:'Prepare safely while live video/audio remains unavailable in MELA.',subject:'What I want to discuss',details:'Questions I can ask without sharing confidential information',next:'A safe follow-up action',checks:['No unapproved video or recording','No secret or payment information','I know how to contact Safety & Privacy'] },
  9: { title:'Draft a weekly learning plan',purpose:'Organize independent study; use My Mentorship above to save real goals.',subject:'This week’s goal',details:'Study activities and resources',next:'One observable milestone',checks:['My goal is specific','My plan is achievable','I can explain how to check progress'] },
  10: { title:'Turn a guide into action',purpose:'Reflect on a resource you read in the published library.',subject:'Resource topic or title',details:'Three ideas I learned',next:'One idea I will practise',checks:['I read the source material','I checked its relevance','I chose a practical next step'] },
  11: { title:'Prepare an assignment response',purpose:'Practice explaining your work. Real submission requires an assigned task.',subject:'Assignment topic',details:'My answer or approach',next:'What feedback would help me improve',checks:['I used my own work','I can show my process','I will submit only to an assigned task'] },
  12: { title:'Reflect on my progress',purpose:'Record personal evidence; this worksheet is not a certificate or verified result.',subject:'Skill or goal I worked on',details:'What I completed and what evidence exists',next:'What I need to improve',checks:['My description is accurate','I distinguish practice from verification','I can identify a next milestone'] },
  13: { title:'Prepare for group mentorship',purpose:'Think about group learning. This does not join or reserve a group.',subject:'Group topic of interest',details:'What I can contribute and learn',next:'Question about facilitator or supervision',checks:['I will check eligibility','I will use approved supervised groups','I understand interest is not enrollment'] },
  14: { title:'Prepare a mentor teaching plan',purpose:'Draft a session outline; private mentor tools require a verified account.',subject:'Topic I could teach',details:'Learning objective and short exercise',next:'Feedback I would request from a learner',checks:['My expertise must be independently reviewed','I will respect guardian and learner safeguards','I will not access another mentor’s records'] },
  15: { title:'Review my safety checklist',purpose:'Practice safe participation. This worksheet is NOT a confidential incident report.',subject:'A general safety rule to remember',details:'Where I can find MELA guardian and reporting controls',next:'What I will do if I feel unsafe',checks:['I will use the actual reporting tool for concerns','I will not include personal case details here','I know consent and age restrictions apply'] },
  16: { title:'Prepare an admin acceptance checklist',purpose:'Rehearse test steps only. No administrative approval or MFA action occurs here.',subject:'Admin workflow I want to verify',details:'Expected authorization, audit and denial behavior',next:'Evidence a real authorized reviewer should check',checks:['Only verified MFA administrators can approve','I will test denied access for other roles','I will not mark untested actions as passed'] },
}

export default function MentorshipPracticeLab({ section }: { section: number }) {
  const exercise = PRACTICE_EXERCISES[section]
  const [subject, setSubject] = useState('')
  const [details, setDetails] = useState('')
  const [next, setNext] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [checks, setChecks] = useState<boolean[]>([false,false,false])
  const [worksheet, setWorksheet] = useState('')
  const [error, setError] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  if (!exercise) return null

  const ready = subject.trim().length >= 3 && next.trim().length >= 3
  const createWorksheet = () => {
    if (!ready) {
      setError('Complete the topic and the next step to generate your worksheet.')
      return
    }
    if (section === 7 && preferredTime && (Number.isNaN(new Date(preferredTime).getTime()) || new Date(preferredTime).getTime() <= Date.now())) {
      setError('Choose a future preferred date and time, or leave it blank.')
      return
    }
    const lines = [
      'MELA MENTORSHIP — PRACTICE WORKSHEET',
      String(section) + '. ' + exercise.title,
      'PRACTICE ONLY — not saved to MELA, not sent to mentors, and not an approval.',
      '',
      exercise.subject + ': ' + subject.trim(),
      exercise.details + ': ' + (details.trim() || 'Not entered'),
      exercise.next + ': ' + next.trim(),
    ]
    if (section === 7 && preferredTime) {
      lines.push('Preferred local time (NOT BOOKED): ' + new Date(preferredTime).toLocaleString())
    }
    lines.push('', 'My checklist:')
    exercise.checks.forEach((check, index) => lines.push((checks[index] ? '[x] ' : '[ ] ') + check))
    setWorksheet(lines.join('\n'))
    setError('')
    setCopyStatus('')
  }
  const reset = () => {
    setSubject('');setDetails('');setNext('');setPreferredTime('')
    setChecks([false,false,false]);setWorksheet('');setError('');setCopyStatus('')
  }
  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Copy is unavailable in this browser.')
      await navigator.clipboard.writeText(worksheet)
      setCopyStatus('Worksheet copied to your clipboard.')
    } catch {
      setCopyStatus('Clipboard access is unavailable. Select and copy the worksheet text below instead.')
    }
  }

  return <section className="empty-panel" aria-label={'Practice tools for section ' + section} style={{ textAlign:'left', borderTop:'3px solid #167b89' }}>
    <h2>Try it now: {exercise.title}</h2>
    <p>{exercise.purpose}</p>
    <p className="muted">Interactive practice only. Your answers stay in this page until you leave or clear them. No backend changes, profile updates, bookings, messages or admin approvals happen here. Avoid entering names, passwords, contact details or confidential evidence.</p>
    <div className="field">
      <label htmlFor="mentorship-practice-subject">{exercise.subject}</label>
      <input id="mentorship-practice-subject" maxLength={160} value={subject}
        onChange={event=>{setSubject(event.target.value);setWorksheet('');setError('')}} placeholder="Write at least three characters" />
    </div>
    <div className="field">
      <label htmlFor="mentorship-practice-details">{exercise.details} (optional)</label>
      <textarea id="mentorship-practice-details" rows={3} maxLength={1500} value={details}
        onChange={event=>{setDetails(event.target.value);setWorksheet('')}} />
    </div>
    <div className="field">
      <label htmlFor="mentorship-practice-next">{exercise.next}</label>
      <input id="mentorship-practice-next" maxLength={240} value={next}
        onChange={event=>{setNext(event.target.value);setWorksheet('');setError('')}} placeholder="Write one clear next action" />
    </div>
    {section === 7 && <div className="field">
      <label htmlFor="mentorship-practice-date">Preferred date and time (optional, not booked)</label>
      <input id="mentorship-practice-date" type="datetime-local" value={preferredTime}
        onChange={event=>{setPreferredTime(event.target.value);setWorksheet('');setError('')}} />
      <p className="muted">Device time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}. Only a verified mentor can confirm a real meeting.</p>
    </div>}
    <fieldset style={{ border:'1px solid var(--line)',borderRadius:'.5rem',padding:'.75rem' }}>
      <legend>My preparation checklist ({checks.filter(Boolean).length}/3)</legend>
      {exercise.checks.map((check,index)=><label key={check} style={{display:'block',margin:'.45rem 0'}}>
        <input type="checkbox" checked={checks[index]} onChange={event=>{
          setChecks(old=>old.map((value,i)=>i===index?event.target.checked:value));setWorksheet('')
        }} /> {check}
      </label>)}
    </fieldset>
    <div style={{ display:'flex',gap:'.5rem',flexWrap:'wrap',marginTop:'.75rem' }}>
      <button type="button" className="btn btn-primary" disabled={!ready} onClick={createWorksheet}>Generate practice worksheet</button>
      <button type="button" className="btn btn-secondary" onClick={reset}>Clear worksheet</button>
    </div>
    {error && <p role="alert" className="banner banner-error">{error}</p>}
    {worksheet && <section aria-label="Generated practice worksheet" style={{marginTop:'1rem'}}>
      <h3>My practice result</h3>
      <p className="muted">This is not a submitted MELA request or a verified completion.</p>
      <textarea aria-label="Worksheet text for copying" readOnly rows={12} value={worksheet} style={{width:'100%'}} />
      <button type="button" className="btn btn-secondary" onClick={()=>void copy()}>Copy practice worksheet</button>
      {copyStatus && <p role="status">{copyStatus}</p>}
    </section>}
  </section>
}
