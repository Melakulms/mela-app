import { useEffect, useRef, useState } from 'react'
import {
  cancelMentorshipRequest,
  cancelMentorshipSession,
  fetchMyMentorshipRequests,
  fetchMyMentorshipSessions,
  fetchVerifiedMentorsPage,
  rateMentorshipSession,
  requestMentor,
  MENTOR_DIRECTORY_PAGE_SIZE,
  type Mentor,
  type MentorshipSession,
  type MyMentorshipRequest,
} from '../lib/mentorship'
import { useI18n } from '../i18n'
import { readMentorshipSection, withMentorshipSection } from '../lib/mentorship-section-navigation'
import MentorshipHome from '../components/MentorshipHome'
import MentorshipLearningWorkspace from '../components/MentorshipLearningWorkspace'
import MentorshipSectionDirectory from '../components/MentorshipSectionDirectory'
import MentorshipPracticeLab from '../components/MentorshipPracticeLab'
import MentorApplication from '../components/MentorApplication'
import MentorshipAdultEligibility from '../components/MentorshipAdultEligibility'
import MentorshipSafetyReporting from '../components/MentorshipSafetyReporting'
import MentorshipCalendarButton from '../components/MentorshipCalendarButton'
import MentorshipSessionJourney from '../components/MentorshipSessionJourney'
import MentorshipOutcomeReview from '../components/MentorshipOutcomeReview'
import { fetchMyMentorshipAccess, type MentorshipAccess } from '../lib/mentorship-access'
import { discoverMentors, getMentorLanguages, MENTORSHIP_CATEGORIES, mentorMatchesCategory, WEEKDAYS, type MentorshipCategory } from '../lib/mentor-discovery'

export default function Mentorship({ onBack, stageKey, onOpenSafety }: { onBack: () => void; stageKey?: string | null; onOpenSafety?: () => void }) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [section, setSection] = useState<number | null>(() => readMentorshipSection(new URL(window.location.href)))
  const selectSection = (next: number | null) => {
    if (next === section) return
    // Preserve the parent learner route so Android Back returns to the section
    // directory instead of unexpectedly closing all Mentorship tools.
    if (new URL(window.location.href).searchParams.get('view') === 'mentorship') {
      const href = withMentorshipSection(new URL(window.location.href), next)
      window.history.pushState(window.history.state, '', href)
    }
    setSection(next)
  }
  const leaveMentorship = () => {
    // A later re-entry must open the directory, not a previously visited private
    // subsection. This does not change server-side account permissions.
    const href = withMentorshipSection(new URL(window.location.href), null)
    window.history.replaceState(window.history.state, '', href)
    onBack()
  }
  useEffect(() => {
    const restore = () => setSection(readMentorshipSection(new URL(window.location.href)))
    const clear = () => setSection(null)
    window.addEventListener('popstate', restore)
    window.addEventListener('mela:session-boundary', clear)
    return () => {
      window.removeEventListener('popstate', restore)
      window.removeEventListener('mela:session-boundary', clear)
    }
  }, [])
  const shows = (...sections: number[]) => section === null || sections.includes(section)
  const [adultReviewApproved,setAdultReviewApproved] = useState(false)
  const [serverAccess,setServerAccess] = useState<MentorshipAccess|null>(null)
  const [accessChecking,setAccessChecking] = useState(true)
  const [accessError,setAccessError] = useState('')
  const [category, setCategory] = useState<MentorshipCategory>('all')
  const [language, setLanguage] = useState('')
  const [weekday,setWeekday] = useState<number|null>(null)
  const [onlyWithAvailability,setOnlyWithAvailability] = useState(false)
  const [sortMentors,setSortMentors] = useState<'relevance'|'rated'|'experience'>('relevance')
  const [mentors, setMentors] = useState<Mentor[] | null>(null)
  const [hasMoreMentors,setHasMoreMentors] = useState(false)
  const [loadingMoreMentors,setLoadingMoreMentors] = useState(false)
  const [requests, setRequests] = useState<MyMentorshipRequest[]>([])
  const [sessions, setSessions] = useState<MentorshipSession[]>([])
  const [error, setError] = useState('')
  const [directoryError, setDirectoryError] = useState('')
  const [requestsError, setRequestsError] = useState('')
  const [sessionsError, setSessionsError] = useState('')
  const [openMentor, setOpenMentor] = useState<string | null>(null)
  const [topic, setTopic] = useState('')
  const [message, setMessage] = useState('')
  const [preferredAt, setPreferredAt] = useState('')
  const [notice, setNotice] = useState('')
  const blockedStage = !['school_11_12', 'university', 'college_tvet'].includes(stageKey ?? '')
  const missingStage = !stageKey
  const directAccessAllowed = !blockedStage && serverAccess?.allowed === true
  const adultReviewRequired = ['university','college_tvet'].includes(stageKey ?? '') && !directAccessAllowed
  const guardianReviewRequired = stageKey === 'school_11_12' && !directAccessAllowed
  const [ratingDraft, setRatingDraft] = useState<Record<string, number>>({})
  const [ratingComment, setRatingComment] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const actionLock = useRef(false)
  const directoryLock = useRef(false)

  useEffect(() => {
    let active = true
    setServerAccess(null)
    setAccessError('')
    if (blockedStage) {
      setAccessChecking(false)
      return () => { active=false }
    }
    setAccessChecking(true)
    void fetchMyMentorshipAccess()
      .then((result) => { if(active) setServerAccess(result) })
      .catch((cause) => {
        if(active) setAccessError(cause instanceof Error ? cause.message : 'Could not verify mentorship access.')
      })
      .finally(() => { if(active) setAccessChecking(false) })
    return () => { active=false }
  },[blockedStage,stageKey,adultReviewApproved,revision])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    setDirectoryError('')
    setRequestsError('')
    setSessionsError('')
    // An unavailable requests or sessions endpoint must not take down mentor
    // discovery, the learner's resources, or other working subsections.
    Promise.allSettled([
      fetchVerifiedMentorsPage(0),
      fetchMyMentorshipRequests(),
      fetchMyMentorshipSessions(),
    ]).then(([directoryResult, requestsResult, sessionsResult]) => {
      if (!active) return
      if (directoryResult.status === 'fulfilled') {
        setMentors(directoryResult.value.mentors)
        setHasMoreMentors(directoryResult.value.hasMore)
      } else {
        setMentors(null)
        setHasMoreMentors(false)
        setDirectoryError(directoryResult.reason instanceof Error
          ? directoryResult.reason.message : 'Could not load verified mentors.')
      }
      if (requestsResult.status === 'fulfilled') {
        setRequests(requestsResult.value)
      } else {
        setRequests([])
        setRequestsError(requestsResult.reason instanceof Error
          ? requestsResult.reason.message : 'Could not load your requests.')
      }
      if (sessionsResult.status === 'fulfilled') {
        setSessions(sessionsResult.value)
      } else {
        setSessions([])
        setSessionsError(sessionsResult.reason instanceof Error
          ? sessionsResult.reason.message : 'Could not load your sessions.')
      }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])

  const loadMoreMentors = async () => {
    if(directoryLock.current || !hasMoreMentors || !mentors)return
    directoryLock.current=true
    setLoadingMoreMentors(true);setError('');setNotice('')
    try{
      const page=await fetchVerifiedMentorsPage(mentors.length,MENTOR_DIRECTORY_PAGE_SIZE)
      setMentors(old=>{
        const added=new Map((old??[]).map(m=>[m.user_id,m]))
        for(const m of page.mentors)added.set(m.user_id,m)
        return [...added.values()]
      })
      setHasMoreMentors(page.hasMore)
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Could not load more verified mentors.')
    }finally{
      directoryLock.current=false;setLoadingMoreMentors(false)
    }
  }

  const alreadyRequested = (mentorId: string) => requests.some((r) => r.mentor_id === mentorId &&
    (r.status === 'pending' || (r.status === 'accepted' && !sessions.some(s => s.request_id === r.id && s.status === 'completed'))))
  const mentorNames = new Map((mentors ?? []).map(m => [m.user_id, m.full_name ?? 'MELA mentor']))
  const requestTopics = new Map(requests.map(r => [r.id, r.topic]))
  const localZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const visibleMentors = discoverMentors(mentors ?? [], {
    query,category,language,weekday,onlyWithAvailability,sort:sortMentors
  })
  const languages = getMentorLanguages(mentors ?? [])
  const pendingCount = requests.filter((request) => request.status === 'pending').length
  const upcomingCount = sessions.filter((session) => session.status === 'scheduled' && new Date(session.scheduled_at).getTime() > Date.now()).length
  const completedCount = sessions.filter((session) => session.status === 'completed').length

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (actionLock.current) return
    actionLock.current = true
    setBusy(key)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice('Your mentorship change was saved.')
      setRevision((value) => value + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that mentorship change. Please retry.')
    } finally {
      actionLock.current = false
      setBusy(null)
    }
  }

  const submitRequest = async (mentorId: string) => {
    if (!directAccessAllowed) {
      setError(blockedStage ? 'This education stage does not have direct mentorship access.' : 'Verified guardian or adult eligibility is required before requesting a mentor.')
      return
    }
    // Without both histories we cannot determine whether an accepted request
    // is already active. Never make an optimistic duplicate submission.
    if (loading || requestsError || sessionsError) {
      setError('Your mentorship history is unavailable. Retry loading requests and sessions before sending another request.')
      return
    }
    const cleanTopic = topic.trim()
    const cleanMessage = message.trim()
    if (cleanTopic.length < 2) { setError('Add a short topic before sending the request.'); return }
    if (cleanTopic.length > 120) { setError('Keep the mentorship topic to 120 characters or fewer.'); return }
    if (cleanMessage.length > 1000) { setError('Keep the message to 1000 characters or fewer.'); return }
    await runAction(`request-${mentorId}`, async () => {
      if (preferredAt) await requestMentor(mentorId, cleanTopic, cleanMessage, preferredAt)
      else await requestMentor(mentorId, cleanTopic, cleanMessage)
      setOpenMentor(null)
      setTopic('')
      setMessage('')
      setPreferredAt('')
    })
  }

  const submitRating = async (sessionId: string) => {
    const rating = ratingDraft[sessionId] ?? 5
    const comment = ratingComment[sessionId] ?? ''
    if (comment.length > 2000) { setError('Keep the rating comment to 2000 characters or fewer.'); return }
    await runAction(`rating-${sessionId}`, async () => {
      await rateMentorshipSession(sessionId, rating, comment)
      setRatingDraft((current) => { const next = { ...current }; delete next[sessionId]; return next })
      setRatingComment((current) => { const next = { ...current }; delete next[sessionId]; return next })
    })
  }

  const closeComposer = () => {
    if (busy) return
    setOpenMentor(null)
    setTopic('')
    setMessage('')
    setPreferredAt('')
    setError('')
  }

  return (
    <div className="dash-main">
      <div className="section-heading">
        <h1>{t('mentorship')}</h1>
        <button className="btn btn-secondary" onClick={leaveMentorship} disabled={!!busy}>{t('back')}</button>
      </div>
      <MentorshipSectionDirectory selected={section} onSelect={selectSection} />
      {section !== null && <details className="empty-panel" style={{ textAlign: 'left' }}>
        <summary>Optional practice worksheet — no real submission or booking</summary>
        <MentorshipPracticeLab key={section} section={section} />
      </details>}
      <div hidden={!shows(1,5)}>
      {shows(1,5) && !loading && !directoryError && mentors && <MentorshipHome
        mentors={mentors}
        requestsAvailable={!requestsError}
        sessionsAvailable={!sessionsError}
        requests={requests}
        sessions={sessions}
        stageKey={stageKey}
        revision={revision}
        onNavigate={selectSection}
        matchingOnly={section === 5}
      />}
      </div>
      <div hidden={!shows(2,3,4,6,7,13,14,15)}>
      {blockedStage && <p role="status" className="banner banner-info">{missingStage ? 'Complete your education profile before using direct mentorship. Learning resources remain available.' : 'Direct mentorship is not enabled for Grades 1–10. Continue with your teacher and guardian through MELA learning resources.'}</p>}
      {stageKey === 'school_11_12' && <p className="banner banner-info">Grades 11–12 require a verified guardian relationship for direct mentorship in the current staging rules.</p>}
      {accessChecking && !blockedStage && <p role="status" className="muted">Checking your current mentorship eligibility…</p>}
      {accessError && !blockedStage && <p role="alert" className="banner banner-error">{accessError} Direct requests remain disabled until eligibility can be verified.</p>}
      {!accessChecking && !accessError && guardianReviewRequired && <p role="status" className="banner banner-info">Your verified guardian clearance is not yet confirmed. Open Safety & Privacy to request or review guardian consent.</p>}
      {shows(2,3,4,6,7,13,14,15) && ['university','college_tvet'].includes(stageKey ?? '') && <MentorshipAdultEligibility onApprovalChange={setAdultReviewApproved} />}
      </div>
      <div hidden={!shows(15)}>
      <section id="mentorship-safety" className="empty-panel" style={{ textAlign:'left' }}><h2>15. Guardian and Safety Center</h2><p>Keep discussions inside approved MELA pathways. Report abusive or unsafe contact. Learners who require verified guardian consent must obtain it before direct mentorship.</p>{onOpenSafety && <button className="btn btn-secondary" disabled={!!busy} onClick={onOpenSafety}>Safety, guardian consent & reporting</button>}</section>
      {shows(15) && <MentorshipSafetyReporting mentors={mentors ?? []} requests={requests} sessions={sessions} />}
      </div>
      <div hidden={!shows(7,8)}>
      <p className="muted">Session times use your device time zone: {localZone}.</p>
      </div>
      <div hidden={!shows(10)}>
      <details id="mentorship-resources" className="empty-panel" style={{ textAlign: 'left' }}>
        <summary>Prepare for a useful session</summary>
        <ol><li>Choose one goal: career exploration, study planning, CV feedback, scholarships or interview practice.</li><li>Write two or three questions and explain what you have already tried.</li><li>After the session, review your mentor’s follow-up notes and agree on one next step.</li></ol>
        <p>Keep passwords, payment details and identity documents private. Report uncomfortable behaviour through Safety & Privacy. A scheduled session does not yet include an in-app video call.</p>
      </details>
      </div>
      {notice && <p className="banner banner-info" role="status">{notice}</p>}
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {loading && <p className="muted" role="status">Loading mentorship…</p>}
      {!loading && shows(1,2,3,4,5) && directoryError && <p className="banner banner-error" role="alert">Mentor directory unavailable: {directoryError}</p>}
      {!loading && shows(1,6) && requestsError && <p className="banner banner-error" role="alert">Your requests are unavailable: {requestsError}</p>}
      {!loading && shows(1,7) && sessionsError && <p className="banner banner-error" role="alert">Your sessions are unavailable: {sessionsError}</p>}
      {!loading && (error || directoryError || requestsError || sessionsError) && <button className="btn btn-secondary" disabled={!!busy} onClick={() => setRevision((value) => value + 1)}>Retry mentorship</button>}

      {/* Learning goals/resources load independently of mentor directory failures. */}
      {shows(9,10,11,12,13) && <MentorshipLearningWorkspace mode="learner" stageKey={stageKey} section={section} />}
      <div hidden={!shows(8)}>
      <section id="mentorship-live" className="empty-panel" style={{ textAlign:'left' }}><h2>8. Live Mentorship</h2><p>Request and schedule sessions through MELA. Integrated audio/video calls are not yet activated. Do not share private contact details or join unapproved off-platform meetings.</p></section>
      </div>
      <div hidden={!shows(14)}>
      {section === 14 && !directAccessAllowed && <p className="empty-panel">This learner account cannot open the private mentor workspace. Eligible adults can apply after completing the eligibility review above. Approved mentors use their mentor account workspace.</p>}
      {['university','college_tvet'].includes(stageKey ?? '') && directAccessAllowed &&
        <details className="empty-panel" style={{ textAlign:'left' }}><summary>Apply to become a verified mentor (eligible adults)</summary><MentorApplication /></details>}
      </div>
      <div hidden={!shows(7)}>
      <div id="mentorship-journey" className="section-heading"><h2>My mentorship journey</h2></div>
      {!loading && !sessionsError && sessions.length === 0 && <p className="empty-panel">No sessions yet. An accepted request is not a booking; your mentor must separately confirm a session within their published available hours.</p>}
      {!loading && !sessionsError && ['university','college_tvet','school_11_12'].includes(stageKey ?? '') && <MentorshipSessionJourney sessions={sessions} />}
      {!loading && !sessionsError && ['university','college_tvet','school_11_12'].includes(stageKey ?? '') && <MentorshipOutcomeReview mode="learner" sessions={sessions} />}
      {!loading && !sessionsError && sessions.length > 0 && <>
        <div className="section-heading"><h2>Your sessions</h2></div>
        <div className="list-panel">
          {sessions.map((session) => {
            const ratingId = `session-rating-${session.id}`
            const commentId = `session-rating-comment-${session.id}`
            return <div className="list-row" key={session.id}>
              <div style={{ flex: 1 }}>
                <strong>{requestTopics.get(session.request_id ?? '') ?? 'Mentorship session'} · {mentorNames.get(session.mentor_id ?? '') ?? 'Your mentor'}</strong>
                <div className="list-row-title">{new Date(session.scheduled_at).toLocaleString()}</div>
                <div className="list-row-meta">{session.duration_min ?? 30} minutes · {session.status}</div>
                <MentorshipCalendarButton session={session} />
                {session.notes && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}><strong>Follow-up notes: </strong>{session.notes}</p>}
                {session.status === 'completed' && session.rating !== null && <div className="list-row-meta">Rated {session.rating}/5{session.rating_comment ? ` · ${session.rating_comment}` : ''}</div>}
                {session.status === 'completed' && session.rating === null && <div style={{ marginTop: '.75rem', display: 'grid', gap: '.5rem', maxWidth: '32rem' }}>
                  <label htmlFor={ratingId}>Rate this completed session</label>
                  <select
                    id={ratingId}
                    value={ratingDraft[session.id] ?? 5}
                    disabled={!!busy}
                    onChange={(event) => setRatingDraft((current) => ({ ...current, [session.id]: Number(event.target.value) }))}
                  >
                    <option value={5}>5 — Excellent</option>
                    <option value={4}>4 — Very good</option>
                    <option value={3}>3 — Good</option>
                    <option value={2}>2 — Needs improvement</option>
                    <option value={1}>1 — Poor</option>
                  </select>
                  <label htmlFor={commentId}>Rating comment (optional)</label>
                  <textarea
                    id={commentId}
                    rows={3}
                    maxLength={2000}
                    value={ratingComment[session.id] ?? ''}
                    disabled={!!busy}
                    onChange={(event) => setRatingComment((current) => ({ ...current, [session.id]: event.target.value }))}
                  />
                  <span className="field-hint">{(ratingComment[session.id] ?? '').length}/2000</span>
                  <button className="btn btn-primary" disabled={!!busy} onClick={() => submitRating(session.id)}>
                    {busy === `rating-${session.id}` ? 'Submitting rating…' : 'Submit rating'}
                  </button>
                </div>}
              </div>
              {session.status === 'scheduled'
                ? <button className="btn btn-secondary" disabled={!!busy} onClick={() => runAction(`session-${session.id}`, () => cancelMentorshipSession(session.id, 'Cancelled by learner'))}>{busy === `session-${session.id}` ? 'Cancelling…' : 'Cancel session'}</button>
                : <span className="pill">{session.status}</span>}
            </div>
          })}
        </div>
      </>}

      </div>
      <div hidden={!shows(6)}>
      {!loading && !requestsError && requests.length === 0 && <section className="empty-panel"><h2>Your requests</h2><p>You have not sent a mentorship request yet.</p><button className="btn btn-primary" onClick={() => setSection(2)}>Find a verified mentor</button></section>}
      {!loading && !requestsError && requests.length > 0 && <>
        <div className="section-heading"><h2>Your requests</h2></div>
        <div className="list-panel">
          {requests.map((r) => <div className="list-row" key={r.id}>
            <div>
              <div className="list-row-title">{r.topic ?? 'Mentorship request'}</div>
              <div>{mentorNames.get(r.mentor_id) ?? 'Your mentor'} · {r.status}</div>
              {r.message && <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{r.message}</p>}
              {r.preferred_at && <p>Preferred time: {new Date(r.preferred_at).toLocaleString()}</p>}
              {r.status === 'accepted' && !sessions.some(s => s.request_id === r.id) && <p>Your mentor has accepted. A session time is still to be scheduled.</p>}
              {r.status === 'accepted' && sessions.some(s => s.request_id === r.id && s.status === 'cancelled') && <p>The session was cancelled. Your mentor can schedule a replacement.</p>}
              <div className="list-row-meta">Requested {new Date(r.created_at).toLocaleDateString()}</div>
            </div>
            {r.status === 'pending'
              ? <button className="btn btn-secondary" disabled={!!busy} onClick={() => runAction(`request-${r.id}`, () => cancelMentorshipRequest(r.id))}>{busy === `request-${r.id}` ? 'Cancelling…' : 'Cancel request'}</button>
              : <span className="pill">{r.status}</span>}
          </div>)}
        </div>
      </>}

      </div>
      <div hidden={!shows(2,3,4)}>
      {!loading && <div id="mentor-directory" className="section-heading"><h2>Find a verified mentor</h2></div>}
      {!loading && mentors && <section className="empty-panel" style={{ textAlign: 'left' }}>
        <p>Browse approved mentors progressively. Search, filters and comparison apply to profiles loaded on this device. Load more profiles to expand your results. Category suggestions are based on reviewed profile text, not a separate certification.</p>
        <div className="field">
          <label htmlFor="mentor-search">Search by name, field, skills, or interests</label>
          <input id="mentor-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. engineering, interview, scholarship" />
        </div>
        <div className="field">
          <label htmlFor="mentor-category">Mentorship category</label>
          <select id="mentor-category" value={category} onChange={(event) => setCategory(event.target.value as MentorshipCategory)}>
            <option value="all">All loaded guidance areas ({mentors.length})</option>
            {MENTORSHIP_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label} ({mentors.filter((mentor) => mentorMatchesCategory(mentor, item.id)).length})</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mentor-language">Mentoring language</label>
          <select id="mentor-language" value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="">Any listed language</option>
            {languages.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mentor-day">Published weekly availability</label>
          <select id="mentor-day" value={weekday===null?'any':String(weekday)}
            onChange={event=>setWeekday(event.target.value==='any'?null:Number(event.target.value))}>
            <option value="any">Any weekday</option>
            {WEEKDAYS.map((day,index)=><option key={day} value={index}>{day}</option>)}
          </select>
        </div>
        <label className="field">
          <input type="checkbox" checked={onlyWithAvailability}
            onChange={event=>setOnlyWithAvailability(event.target.checked)}/>
          Only mentors with published weekly hours
        </label>
        <div className="field"><label htmlFor="mentor-sort">Compare matching mentors</label>
          <select id="mentor-sort" value={sortMentors}
            onChange={event=>setSortMentors(event.target.value as typeof sortMentors)}>
            <option value="relevance">Relevant expertise and name</option>
            <option value="rated">Highest learner rating (rated mentors first)</option>
            <option value="experience">Most reported years of experience</option>
          </select>
          <p className="muted">Ratings come from completed learner sessions. Years of experience come from reviewed mentor profiles, not separate professional certificates.</p>
        </div>
        <p role="status">{visibleMentors.length} matching verified {visibleMentors.length===1?'mentor':'mentors'} among {mentors.length} loaded profiles{hasMoreMentors?' (more profiles available)':''}.</p>
        {(query || language || category !== 'all' || weekday!==null || onlyWithAvailability || sortMentors!=='relevance')
          && <button className="btn btn-secondary" type="button" onClick={() => {
            setQuery('');setCategory('all');setLanguage('');setWeekday(null);
            setOnlyWithAvailability(false);setSortMentors('relevance')
          }}>Clear filters</button>}
      </section>}
      {!loading && mentors && mentors.length === 0 && <div className="empty-panel">No verified mentors have been onboarded yet. Your mentorship requests and sessions will appear here when an approved mentor becomes available.</div>}
      {!loading && mentors && mentors.length > 0 && visibleMentors.length === 0 && <p className="empty-panel">No approved mentor currently matches those filters. Try another guidance area, language, weekday or availability option.</p>}
      {!loading && mentors && visibleMentors.length > 0 && <div className="module-grid">
        {visibleMentors.map((m) => {
          const topicId = `mentor-topic-${m.user_id}`
          const messageId = `mentor-message-${m.user_id}`
          return <div className="module-card" key={m.user_id} style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}>
            <h3 style={{ color: 'var(--ink)' }}>{m.full_name}</h3>
            <p style={{ color: 'var(--muted)' }}>{m.headline ?? m.organization ?? 'MELA mentor'}</p>
            {m.bio && <p>{m.bio}</p>}
            {m.organization && <p>{m.organization}</p>}
            {(m.expertise ?? []).length > 0 && <p><strong>Mentoring fields:</strong> {(m.expertise ?? []).join(', ')}</p>}
            {(m.languages ?? []).length > 0 && <p><strong>Languages:</strong> {(m.languages ?? []).join(', ')}</p>}
            {(m.availability ?? []).length > 0
              ? <details><summary>Published weekly hours ({(m.availability ?? []).length})</summary>
                  <ul>{(m.availability ?? []).map((slot) => <li key={slot.id}>{WEEKDAYS[slot.weekday] ?? 'Day'} · {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)} ({slot.timezone})</li>)}</ul>
                  <p className="muted">Weekly availability is indicative. A mentor must confirm the session.</p>
                </details>
              : <p className="muted">No weekly availability published. You can still submit a request.</p>}
            {m.years_experience != null && <p>{m.years_experience} years of experience</p>
            }
            {m.rating_count > 0 && <p className="muted">{m.rating_average.toFixed(2)}/5 · {m.rating_count} {m.rating_count === 1 ? 'rating' : 'ratings'}</p>}
            {blockedStage ? <span className="pill">Direct mentorship unavailable for this education stage</span>
              : accessChecking ? <span className="pill">Checking verified mentorship eligibility</span>
              : guardianReviewRequired ? <span className="pill">Verified guardian clearance required</span>
              : adultReviewRequired ? <span className="pill">Verify adult eligibility above before requesting</span>
              : (requestsError || sessionsError) ? <span className="pill">Request history unavailable — retry before sending</span>
              : alreadyRequested(m.user_id) ? <span className="pill">Requested</span> : openMentor === m.user_id ? <div>
              <div className="field">
                <label htmlFor={topicId}>Topic</label>
                <input id={topicId} value={topic} maxLength={120} disabled={!!busy} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. CV review" />
                <span className="field-hint">{topic.length}/120</span>
              </div>
              <div className="field">
                <label htmlFor={messageId}>Message (optional)</label>
                <textarea id={messageId} value={message} maxLength={1000} rows={4} disabled={!!busy} onChange={(e) => setMessage(e.target.value)} />
                <span className="field-hint">{message.length}/1000</span>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <div className="field" style={{ width: '100%' }}><label htmlFor={`mentor-preferred-${m.user_id}`}>Preferred session time (optional)</label><input id={`mentor-preferred-${m.user_id}`} type="datetime-local" value={preferredAt} disabled={!!busy} onChange={e => setPreferredAt(e.target.value)} /><span className="field-hint">Time zone: {localZone}. This is a preference only. Your verified mentor must accept your request and separately confirm a session time.</span></div>
                <button className="btn btn-primary" onClick={() => submitRequest(m.user_id)} disabled={!!busy || topic.trim().length < 2}>{busy === `request-${m.user_id}` ? 'Sending…' : 'Send request'}</button>
                <button className="btn btn-secondary" onClick={closeComposer} disabled={!!busy}>Cancel</button>
              </div>
            </div> : <button className="btn btn-secondary" disabled={!!busy || loading} onClick={() => { setOpenMentor(m.user_id); setTopic(''); setMessage(''); setPreferredAt(''); setError('') }}>Request mentorship</button>}
          </div>
        })}
      </div>}
      {!loading && mentors && hasMoreMentors && <button type="button" className="btn btn-secondary"
        onClick={()=>void loadMoreMentors()} disabled={loadingMoreMentors||!!busy}>
        {loadingMoreMentors?'Loading verified mentor profiles…':'Load more verified mentors'}
      </button>}
      </div>
    </div>
  )
}

