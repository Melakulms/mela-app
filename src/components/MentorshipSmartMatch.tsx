import { useState } from 'react'
import type { Mentor, MyMentorshipRequest } from '../lib/mentorship'
import { getMentorLanguages } from '../lib/mentor-discovery'
import { recommendMentors } from '../lib/mentorship-home'

/** Temporary input, not personal profile data and not a recommendation credential. */
export default function MentorshipSmartMatch({
  mentors, requests, requestsAvailable, stageKey, onBrowse,
}: {
  mentors: Mentor[]
  requests: MyMentorshipRequest[]
  requestsAvailable: boolean
  stageKey?: string | null
  onBrowse: () => void
}) {
  const [goal, setGoal] = useState('')
  const [language, setLanguage] = useState('')
  const [submittedGoal, setSubmittedGoal] = useState('')
  const [chosenLanguage, setChosenLanguage] = useState('')
  const restricted = !['school_11_12','university','college_tvet'].includes(stageKey ?? '')
  const valid = goal.trim().length >= 3
  // Request history must be known to safely exclude already-contacted mentors.
  const available = requestsAvailable && !restricted
  const results = available && submittedGoal
    ? recommendMentors(mentors, [submittedGoal], chosenLanguage, requests, stageKey)
    : []
  const apply = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid) return
    setSubmittedGoal(goal.trim())
    setChosenLanguage(language)
  }

  return <section className="empty-panel" style={{textAlign:'left'}}
    aria-label="Find mentors by my learning goal">
    <h2>Find mentors for a specific goal</h2>
    <p>Type the skill or career topic you need help with. Matching compares words in verified published mentor profiles. This is an exploratory text match, not an AI judgment, identity review or booked appointment.</p>
    {restricted ? <p className="banner banner-info">Direct mentor matching is not available for this education stage. You can continue using MELA's learning resources with your teacher or guardian.</p> :
      !requestsAvailable ? <p className="banner banner-info" role="status">Request history is unavailable. Matching is paused to avoid recommending a mentor you already contacted. Retry mentorship to refresh your history.</p> :
      <form onSubmit={apply}>
        <div className="field"><label htmlFor="matching-goal">My learning or career goal</label>
          <input id="matching-goal" maxLength={160} minLength={3} required
            value={goal} onChange={event => {setGoal(event.target.value);setSubmittedGoal('')}}
            placeholder="e.g. programming, university scholarship, marketing"/>
        </div>
        <div className="field"><label htmlFor="matching-language">Preferred mentor language (optional)</label>
          <select id="matching-language" value={language} onChange={event=>{setLanguage(event.target.value);setSubmittedGoal('')}}>
            <option value="">Any published language</option>
            {getMentorLanguages(mentors).map(value=><option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary" disabled={!valid}>Find matching mentors</button>
      </form>}
    {submittedGoal && available && <>
      <p role="status">{results.length} verified profile matches for “{submittedGoal}” among {mentors.length} loaded mentors.
        {results.length >= 3 ? ' Showing up to three strongest text matches.' : ''}
      </p>
      {results.length ? <div className="module-grid">
        {results.map(mentor=><article key={mentor.user_id} className="module-card" style={{background:'var(--surface)',border:'1px solid var(--line)'}}>
          <h3>{mentor.full_name || 'Verified mentor'}</h3>
          <p>{mentor.headline || 'Published mentor profile'}</p>
          <p className="muted">{(mentor.expertise ?? []).join(', ') || 'Expertise not listed'}</p>
          <button type="button" className="btn btn-secondary" onClick={onBrowse}>Open verified mentor directory</button>
        </article>)}
      </div> : <p className="muted">No verified mentor profile matches this goal in the currently loaded directory. Try a broader skill, different language, or browse the directory; do not interpret zero matches as a qualification decision.</p>}
    </>}
    {!restricted && <button type="button" className="btn btn-secondary" onClick={onBrowse}>Browse all loaded verified mentors</button>}
    <p className="muted">This search remains on this screen and is not saved to your MELA profile. A verified mentor, valid guardian/adult eligibility and a separate confirmed booking remain mandatory for direct sessions.</p>
  </section>
}
