import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
vi.mock('../src/components/MentorshipLearningWorkspace', () => ({ default: () => null }))
vi.mock('../src/components/MentorshipProgramPlanner', () => ({ default: () => null }))
vi.mock('../src/components/MentorApplication', () => ({ default: () => null }))
vi.mock('../src/components/MentorshipAdultEligibility', () => ({ default: () => null }))
vi.mock('../src/components/MentorshipSafetyReporting', () => ({ default: () => null }))
vi.mock('../src/components/MentorshipSessionJourney', () => ({ default: ({sessions}: {sessions: {id:string}[]}) => <div data-testid="session-journey">{sessions.length} session plans</div> }))
vi.mock('../src/components/MentorshipOutcomeReview', () => ({ default: () => null }))
import Mentorship from '../src/pages/Mentorship'

const mocks = vi.hoisted(() => ({
  fetchVerifiedMentorsPage: vi.fn(),
  fetchMyMentorshipRequests: vi.fn(),
  fetchMyMentorshipSessions: vi.fn(),
  requestMentor: vi.fn(),
  cancelMentorshipRequest: vi.fn(),
  cancelMentorshipSession: vi.fn(),
  rateMentorshipSession: vi.fn(),
  fetchMyMentorshipAccess: vi.fn(),
}))

vi.mock('../src/lib/mentorship-access', () => ({ fetchMyMentorshipAccess: mocks.fetchMyMentorshipAccess }))

vi.mock('../src/lib/mentorship', () => ({
  MENTOR_DIRECTORY_PAGE_SIZE: 50,
  fetchVerifiedMentorsPage: mocks.fetchVerifiedMentorsPage,
  fetchMyMentorshipRequests: mocks.fetchMyMentorshipRequests,
  fetchMyMentorshipSessions: mocks.fetchMyMentorshipSessions,
  requestMentor: mocks.requestMentor,
  cancelMentorshipRequest: mocks.cancelMentorshipRequest,
  cancelMentorshipSession: mocks.cancelMentorshipSession,
  rateMentorshipSession: mocks.rateMentorshipSession,
}))

const mentor = {
  user_id: 'mentor-1',
  full_name: 'Mentor One',
  headline: 'Software engineer',
  bio: null,
  organization: null,
  years_experience: 5,
  rating_average: 4.75,
  rating_count: 8,
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchVerifiedMentorsPage.mockResolvedValue({mentors:[mentor],hasMore:false})
  mocks.fetchMyMentorshipRequests.mockResolvedValue([])
  mocks.fetchMyMentorshipSessions.mockResolvedValue([])
  mocks.requestMentor.mockResolvedValue(undefined)
  mocks.cancelMentorshipRequest.mockResolvedValue(undefined)
  mocks.cancelMentorshipSession.mockResolvedValue(undefined)
  mocks.rateMentorshipSession.mockResolvedValue(undefined)
  mocks.fetchMyMentorshipAccess.mockResolvedValue({allowed:true,reason:'eligible'})
})

afterEach(cleanup)

describe('Mentorship', () => {
  it('shows only one card directory until a learner chooses a subsection', async () => {
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
    expect(screen.getAllByRole('button',{name:/^Open /})).toHaveLength(16)
    expect(screen.queryByText('Mentor One')).toBeNull()
    expect(screen.queryByRole('heading',{name:'Find a verified mentor'})).toBeNull()
    expect(screen.queryByRole('heading',{name:'Your requests'})).toBeNull()
    // The directory itself must not query private mentoring records.
    expect(mocks.fetchVerifiedMentorsPage).not.toHaveBeenCalled()
    expect(mocks.fetchMyMentorshipRequests).not.toHaveBeenCalled()
    expect(mocks.fetchMyMentorshipSessions).not.toHaveBeenCalled()
    expect(mocks.fetchMyMentorshipAccess).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Open Find a Mentor'}))
    expect(screen.getByRole('heading',{name:'2. Find a Mentor'})).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Open Resources'})).toBeNull()
    expect(screen.getAllByRole('button',{name:'All mentorship sections'})).toHaveLength(1)
    expect(await screen.findByText('Mentor One')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'All mentorship sections'}))
    expect(screen.getAllByRole('button',{name:/^Open /})).toHaveLength(16)
    expect(screen.queryByText('Mentor One')).toBeNull()
    const callCount = mocks.fetchVerifiedMentorsPage.mock.calls.length
    fireEvent.click(screen.getByRole('button',{name:'Open Resources'}))
    expect(screen.getByRole('heading',{name:'10. Resources'})).toBeTruthy()
    expect(screen.queryByRole('heading',{name:'Find a verified mentor'})).toBeNull()
    expect(mocks.fetchVerifiedMentorsPage).toHaveBeenCalledTimes(callCount)
  })

  it('loads further verified mentors in bounded pages without losing existing profiles',async()=>{
    mocks.fetchVerifiedMentorsPage.mockImplementation((offset:number)=>
      Promise.resolve(offset===0
        ? {mentors:[mentor],hasMore:true}
        : {mentors:[{...mentor,user_id:'mentor-2',full_name:'Mentor Two'}],hasMore:false})
    )
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()}/>)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
    expect(await screen.findByText('Mentor One')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Load more verified mentors'}))
    expect(await screen.findByText('Mentor Two')).toBeTruthy()
    expect(screen.getByText('Mentor One')).toBeTruthy()
    expect(mocks.fetchVerifiedMentorsPage).toHaveBeenCalledWith(0)
    expect(mocks.fetchVerifiedMentorsPage).toHaveBeenCalledWith(1,50)
    expect(screen.queryByRole('button',{name:'Load more verified mentors'})).toBeNull()
  })

  it('keeps school learner requests closed until verified guardian clearance', async()=>{
    mocks.fetchMyMentorshipAccess.mockResolvedValue({allowed:false,reason:'verified_guardian_required'})
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
    await screen.findByText('Mentor One')
    expect(await screen.findByText('Verified guardian clearance required')).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Request mentorship'})).toBeNull()
    expect(mocks.requestMentor).not.toHaveBeenCalled()
  })

  it('fails closed when the server eligibility status request fails',async()=>{
    mocks.fetchMyMentorshipAccess.mockRejectedValue(new Error('Access verification unavailable'))
    render(<Mentorship stageKey="university" onBack={vi.fn()}/>)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Access verification unavailable')
    expect(screen.queryByRole('button',{name:'Request mentorship'})).toBeNull()
  })

  it('fails closed with no education stage and does not offer adult mentor applications to school learners', async () => {
    const {rerender}=render(<Mentorship onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
    await screen.findByText('Mentor One')
    expect(screen.getByText(/Complete your education profile before using direct mentorship/)).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Request mentorship'})).toBeNull()
    expect(screen.queryByText(/Apply to become a verified mentor/)).toBeNull()
    rerender(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
    await screen.findByText(/Grades 11–12 require a verified guardian relationship/)
    expect(screen.queryByText(/Apply to become a verified mentor/)).toBeNull()
    expect(mocks.requestMentor).not.toHaveBeenCalled()
  })

  it('keeps unverified university adult learners out of direct mentorship requests',async()=>{
    mocks.fetchMyMentorshipAccess.mockResolvedValue({allowed:false,reason:'approved_adult_review_required'})
    render(<Mentorship stageKey="university" onBack={vi.fn()}/>)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
    await screen.findByText('Mentor One')
    expect(await screen.findByText('Verify adult eligibility above before requesting')).toBeTruthy()
    expect(screen.queryByRole('button',{name:'Request mentorship'})).toBeNull()
    expect(mocks.requestMentor).not.toHaveBeenCalled()
  })

  it('explains grade restrictions and opens the safety flow without offering a request', async () => {
    const safety = vi.fn()
    render(<Mentorship stageKey="school_9_10" onBack={vi.fn()} onOpenSafety={safety} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Guardian and Safety'}))
    await screen.findByText(/Direct mentorship is not enabled for Grades 1–10/)
    expect(screen.queryByRole('button', { name: 'Request mentorship' })).toBeNull()
    expect(screen.getByText(/Direct mentorship is not enabled for Grades 1–10/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Safety, guardian consent & reporting' }))
    expect(safety).toHaveBeenCalledTimes(1)
    expect(mocks.requestMentor).not.toHaveBeenCalled()
  })

  it('sends the preferred time and retains the request draft after a failure', async () => {
    mocks.requestMentor.mockRejectedValueOnce(new Error('Try again'))
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
    await screen.findByText('Mentor One')
    fireEvent.click(screen.getByRole('button', { name: 'Request mentorship' }))
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'Study plan' } })
    fireEvent.change(screen.getByLabelText('Preferred session time (optional)'), { target: { value: '2099-11-01T10:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Try again')
    expect((screen.getByLabelText('Topic') as HTMLInputElement).value).toBe('Study plan')
    expect((screen.getByLabelText('Preferred session time (optional)') as HTMLInputElement).value).toBe('2099-11-01T10:00')
    expect(mocks.requestMentor).toHaveBeenCalledWith('mentor-1', 'Study plan', '', '2099-11-01T10:00')
  })

  it('shows follow-up notes and allows a new request after a completed session', async () => {
    mocks.fetchMyMentorshipRequests.mockResolvedValue([{ id: 'request-1', mentor_id: 'mentor-1', topic: 'CV review', status: 'accepted', created_at: '2026-10-02T10:00:00Z' }])
    mocks.fetchMyMentorshipSessions.mockResolvedValue([{ id: 'session-1', request_id: 'request-1', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-04T10:00:00Z', duration_min: 30, status: 'completed', rating: 5, rating_comment: null, notes: 'Revise the project section of your CV.' }])
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Booking and Scheduling'}))
    await screen.findByText(/Revise the project section of your CV/)
    expect(screen.getByText(/Revise the project section of your CV/)).toBeTruthy()
    expect(screen.getByTestId('session-journey').textContent).toBe('1 session plans')
    fireEvent.click(screen.getByRole('button',{name:'All mentorship sections'}))
    fireEvent.click(screen.getByRole('button',{name:'Open Find a Mentor'}))
    expect(await screen.findByRole('button', { name: 'Request mentorship' })).toBeTruthy()
  })

  it('surfaces load failures and retries without leaving a stale error', async () => {
    mocks.fetchVerifiedMentorsPage.mockRejectedValueOnce(new Error('Network unavailable'))
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))

    expect((await screen.findByRole('alert')).textContent).toContain('Network unavailable')
    fireEvent.click(screen.getByRole('button', { name: 'Retry mentorship' }))

    expect(await screen.findByText('Mentor One')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('validates the topic and serializes request submission', async () => {
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
    await screen.findByText('Mentor One')

    fireEvent.click(screen.getByRole('button', { name: 'Request mentorship' }))
    const topic = screen.getByLabelText('Topic')
    const send = screen.getByRole('button', { name: 'Send request' }) as HTMLButtonElement
    expect(send.disabled).toBe(true)

    fireEvent.change(topic, { target: { value: 'CV review' } })
    fireEvent.change(screen.getByLabelText('Message (optional)'), { target: { value: 'Please review my CV.' } })
    fireEvent.click(send)
    fireEvent.click(send)

    await waitFor(() => expect(mocks.requestMentor).toHaveBeenCalledTimes(1))
    expect(mocks.requestMentor).toHaveBeenCalledWith('mentor-1', 'CV review', 'Please review my CV.')
    await waitFor(() => expect(mocks.fetchVerifiedMentorsPage).toHaveBeenCalledTimes(2))
  })

  it('allows learners to cancel a pending request and a scheduled session', async () => {
    mocks.fetchMyMentorshipRequests.mockResolvedValue([{ id: 'request-1', mentor_id: 'mentor-1', topic: 'Interview prep', status: 'pending', created_at: '2026-10-02T10:00:00Z' }])
    mocks.fetchMyMentorshipSessions.mockResolvedValue([{ id: 'session-1', request_id: 'request-2', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-04T10:00:00Z', duration_min: 30, status: 'scheduled', call_room_id: null, completed_at: null, cancelled_at: null, rating: null, rating_comment: null }])
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Booking and Scheduling'}))

    await screen.findByText('Your sessions')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel session' }))
    await waitFor(() => expect(mocks.cancelMentorshipSession).toHaveBeenCalledWith('session-1', 'Cancelled by learner'))

    await waitFor(() => expect(mocks.fetchMyMentorshipRequests).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('button', { name: 'All mentorship sections' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Mentorship Programs & Requests' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }))
    await waitFor(() => expect(mocks.cancelMentorshipRequest).toHaveBeenCalledWith('request-1'))
  })

  it('shows mentor rating summaries and submits one rating for a completed session', async () => {
    mocks.fetchMyMentorshipSessions
      .mockResolvedValueOnce([{ id: 'session-2', request_id: 'request-3', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-03T10:00:00Z', duration_min: 45, status: 'completed', call_room_id: null, completed_at: '2026-10-03T10:45:00Z', cancelled_at: null, rating: null, rating_comment: null }])
      .mockResolvedValueOnce([{ id: 'session-2', request_id: 'request-3', mentor_id: 'mentor-1', mentee_id: 'learner', scheduled_at: '2026-10-03T10:00:00Z', duration_min: 45, status: 'completed', call_room_id: null, completed_at: '2026-10-03T10:45:00Z', cancelled_at: null, rating: 4, rating_comment: 'Helpful feedback.' }])

    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Booking and Scheduling'}))
    fireEvent.click(screen.getByRole('button', { name: 'All mentorship sections' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Find a Mentor' }))
    expect(await screen.findByText('4.75/5 · 8 ratings')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'All mentorship sections' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open Booking and Scheduling' }))

    fireEvent.change(screen.getByLabelText('Rate this completed session'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Rating comment (optional)'), { target: { value: 'Helpful feedback.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit rating' }))

    await waitFor(() => expect(mocks.rateMentorshipSession).toHaveBeenCalledTimes(1))
    expect(mocks.rateMentorshipSession).toHaveBeenCalledWith('session-2', 4, 'Helpful feedback.')
    expect(await screen.findByText('Rated 4/5 · Helpful feedback.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Submit rating' })).toBeNull()
  })
})


it('opens requests directly, shows an empty state, and navigates to real mentor tools', async () => {
  render(<Mentorship stageKey="university" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Mentorship Programs & Requests'}))
  await screen.findByRole('heading',{name:'Your requests'})
  expect(screen.getByRole('heading',{name:'Your requests'})).toBeTruthy()
  expect(screen.queryByLabelText('Search by name, field, skills, or interests', {selector: 'input:not([hidden])'})?.closest('[hidden]')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Find a verified mentor'}))
  expect(screen.getByRole('heading',{name:'Find a verified mentor'})).toBeTruthy()
  expect(screen.getByRole('searchbox',{name:'Search by name, field, skills, or interests'})).toBeTruthy()
  expect(screen.queryByRole('heading',{name:'Your requests'})).toBeNull()
})


it('keeps verified mentor discovery accessible when private request history fails', async () => {
  mocks.fetchMyMentorshipRequests.mockRejectedValueOnce(new Error('Request history temporarily unavailable'))
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
  expect(await screen.findByText('Mentor One')).toBeTruthy()
  expect(screen.getByText('Request history unavailable — retry before sending')).toBeTruthy()
  expect(screen.getByRole('searchbox', { name:'Search by name, field, skills, or interests' })).toBeTruthy()
  expect(screen.getByText('Mentor One')).toBeTruthy()
  expect(screen.queryByText(/No verified mentors have been onboarded/)).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Retry mentorship'}))
  await waitFor(() => expect(mocks.fetchMyMentorshipRequests).toHaveBeenCalledTimes(2))
  expect(screen.queryByText(/Request history temporarily unavailable/)).toBeNull()
})

it('keeps saved mentorship requests actionable when mentor search is unavailable', async () => {
  mocks.fetchVerifiedMentorsPage.mockRejectedValueOnce(new Error('Mentor directory unavailable'))
  mocks.fetchMyMentorshipRequests.mockResolvedValue([{id:'request-41',mentor_id:'mentor-41',topic:'Career options',status:'pending',created_at:'2026-10-10T10:00:00Z'}])
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Mentorship Programs & Requests'}))
  expect(await screen.findByText('Career options')).toBeTruthy()
  // A failed mentor search must not hide or disable existing request history.
  fireEvent.click(screen.getByRole('button', {name:'Cancel request'}))
  await waitFor(() => expect(mocks.cancelMentorshipRequest).toHaveBeenCalledWith('request-41'))
})

it('does not present a failed session history query as an empty confirmed calendar', async () => {
  mocks.fetchMyMentorshipSessions.mockRejectedValueOnce(new Error('Calendar service unavailable'))
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Booking and Scheduling'}))
  expect(await screen.findByText(/Calendar service unavailable/)).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('Calendar service unavailable')
  expect(screen.queryByText(/No sessions yet. An accepted request is not a booking/)).toBeNull()
  fireEvent.click(screen.getByRole('button', {name:'All mentorship sections'}))
  fireEvent.click(screen.getByRole('button', {name:'Open Find a Mentor'}))
  expect(screen.getByText('Mentor One')).toBeTruthy()
})


it('keeps Mentorship subsection history on Android Back and restores the directory', async () => {
  const original = window.location.href
  window.history.replaceState(null, '', '/?view=mentorship')
  try {
    render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
    expect(screen.getAllByRole('button',{name:/^Open /})).toHaveLength(16)
    fireEvent.click(screen.getByRole('button', { name: 'Open Resources' }))
    expect(new URL(window.location.href).searchParams.get('mentorship_section')).toBe('10')
    expect(screen.getByRole('heading', { name: '10. Resources' })).toBeTruthy()
    const directoryUrl = new URL(window.location.href)
    directoryUrl.searchParams.delete('mentorship_section')
    window.history.replaceState(null, '', directoryUrl)
    fireEvent.popState(window)
    expect(screen.getByRole('heading', { name: 'Explore all 16 mentorship sections' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Open Guardian and Safety' }))
    expect(new URL(window.location.href).searchParams.get('mentorship_section')).toBe('15')
    fireEvent.click(screen.getByRole('button', { name: 'All mentorship sections' }))
    expect(new URL(window.location.href).searchParams.has('mentorship_section')).toBe(false)
  } finally {
    window.history.replaceState(null, '', original)
  }
})


it('fails closed on new mentor requests when private request or session history is unavailable', async () => {
  mocks.fetchMyMentorshipRequests.mockRejectedValueOnce(new Error('History read failed'))
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
  await screen.findByText('Mentor One')
  expect(screen.getByText('Request history unavailable — retry before sending')).toBeTruthy()
  expect(screen.queryByRole('button', {name:'Request mentorship'})).toBeNull()
  expect(mocks.requestMentor).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name:'Retry mentorship'}))
  await waitFor(() => expect(mocks.fetchMyMentorshipRequests).toHaveBeenCalledTimes(2))
  expect(await screen.findByRole('button', {name:'Request mentorship'})).toBeTruthy()
})

it('opens guidance-category cards and preserves the chosen verified mentor filter on Android', async () => {
  mocks.fetchVerifiedMentorsPage.mockResolvedValue({
    mentors:[{...mentor,headline:'Software engineer',expertise:['Programming and AI'],languages:['Amharic'],availability:[]}],
    hasMore:false,
  })
  render(<Mentorship stageKey="university" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Mentorship Categories'}))
  expect(screen.getByRole('heading',{name:'Explore mentorship by guidance area'})).toBeTruthy()
  const explore = screen.getByRole('button',{name:'Explore Technology & AI'}) as HTMLButtonElement
  await waitFor(() => expect(explore.disabled).toBe(false))
  fireEvent.click(explore)
  expect(screen.getByRole('heading',{name:'2. Find a Mentor'})).toBeTruthy()
  expect((screen.getByLabelText('Mentorship category') as HTMLSelectElement).value).toBe('technology')
  expect(screen.getByText('Mentor One')).toBeTruthy()
})


it('filters authentic request history without deleting pending decisions or marking acceptance as a booking', async () => {
  mocks.fetchMyMentorshipRequests.mockResolvedValue([
    {id:'p',mentor_id:'mentor-1',topic:'Pending questions',status:'pending',created_at:'2026-10-20T10:00:00Z'},
    {id:'a',mentor_id:'mentor-1',topic:'Accepted questions',status:'accepted',created_at:'2026-10-21T10:00:00Z'},
    {id:'d',mentor_id:'mentor-1',topic:'Declined questions',status:'declined',created_at:'2026-10-22T10:00:00Z'},
  ])
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Mentorship Programs & Requests'}))
  await screen.findByText('Pending questions')

  expect(screen.getByText('Accepted questions')).toBeTruthy()
  expect(screen.getByText('Declined questions')).toBeTruthy()
  expect(screen.getByText(/Accepted means a mentor agreed to your request/)).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Filter my requests'),{target:{value:'pending'}})
  expect(screen.getByText('Pending questions')).toBeTruthy()
  expect(screen.queryByText('Accepted questions')).toBeNull()
  fireEvent.change(screen.getByLabelText('Filter my requests'),{target:{value:'accepted'}})
  expect(screen.getByText('Accepted questions')).toBeTruthy()
  expect(screen.queryByText('Pending questions')).toBeNull()
  fireEvent.change(screen.getByLabelText('Filter my requests'),{target:{value:'finished'}})
  expect(screen.getByText('Declined questions')).toBeTruthy()
  expect(screen.queryByText('Accepted questions')).toBeNull()
  fireEvent.change(screen.getByLabelText('Filter my requests'),{target:{value:'all'}})
  expect(screen.getByText('Pending questions')).toBeTruthy()
  expect(screen.getByRole('button',{name:'Cancel request'})).toBeTruthy()
})


it('allows comparing only three real verified profiles without opening restricted request actions', async () => {
  mocks.fetchVerifiedMentorsPage.mockResolvedValue({
    mentors: [1,2,3,4].map(i=>({
      ...mentor,user_id:'verified-'+i,full_name:'Verified '+i,
      expertise:['Programming'],languages:['Amharic'],availability:[],
    })),
    hasMore:false,
  })
  mocks.fetchMyMentorshipAccess.mockResolvedValue({allowed:false,reason:'verified_guardian_required'})
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Mentor Profiles'}))
  await screen.findByText('Verified 1')

  const addButtons = screen.getAllByRole('button',{name:'Add to comparison'})
  expect(addButtons).toHaveLength(4)
  fireEvent.click(addButtons[0])
  fireEvent.click(addButtons[1])
  fireEvent.click(addButtons[2])
  expect(screen.getByText('3 of 3 profiles selected for comparison.')).toBeTruthy()
  expect((screen.getByRole('button',{name:'Add to comparison'}) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByRole('button',{name:'Request mentorship'})).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Clear comparison'}))
  expect(screen.getByText('0 of 3 profiles selected for comparison.')).toBeTruthy()
  expect(screen.getAllByRole('button',{name:'Add to comparison'})).toHaveLength(4)
})


it('clears personal mentor requests immediately when the signed-in account changes', async () => {
  mocks.fetchMyMentorshipRequests
    .mockResolvedValueOnce([{
      id:'private-request',mentor_id:'mentor-1',topic:'Private scholarship planning',
      status:'pending',created_at:'2026-10-27T10:00:00Z',
    }])
    .mockResolvedValueOnce([])
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Mentorship Programs & Requests'}))
  expect(await screen.findByText('Private scholarship planning')).toBeTruthy()
  fireEvent(window, new Event('mela:session-boundary'))
  expect(screen.queryByText('Private scholarship planning')).toBeNull()
  expect(mocks.fetchMyMentorshipRequests).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Mentorship session changed')).toBeTruthy()
  expect(screen.queryByText('Private scholarship planning')).toBeNull()
})

it('ignores a private request response from before the account-switch event', async () => {
  let releaseOldRequest!: (records: any[]) => void
  mocks.fetchMyMentorshipRequests
    .mockReturnValueOnce(new Promise(resolve => { releaseOldRequest = resolve }))
    .mockResolvedValueOnce([])
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Mentorship Programs & Requests'}))
  await waitFor(() => expect(mocks.fetchMyMentorshipRequests).toHaveBeenCalledTimes(1))
  fireEvent(window, new Event('mela:session-boundary'))
  expect(mocks.fetchMyMentorshipRequests).toHaveBeenCalledTimes(1)
  expect(screen.getByText('Mentorship session changed')).toBeTruthy()
  await act(async () => {
    releaseOldRequest([{
      id:'old-request',mentor_id:'mentor-1',topic:'Old account confidential request',
      status:'pending',created_at:'2026-10-27T10:00:00Z',
    }])
  })
  expect(screen.queryByText('Old account confidential request')).toBeNull()
})

it('does not show an old account action as saved after the session boundary', async () => {
  let finishOldAction!: () => void
  mocks.requestMentor.mockImplementationOnce(() => new Promise<void>(resolve => { finishOldAction = resolve }))
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Find a Mentor'}))
  await screen.findByText('Mentor One')
  fireEvent.click(screen.getByRole('button', {name:'Request mentorship'}))
  fireEvent.change(screen.getByLabelText('Topic'), {target:{value:'Private academic help'}})
  fireEvent.click(screen.getByRole('button', {name:'Send request'}))
  await waitFor(() => expect(mocks.requestMentor).toHaveBeenCalledTimes(1))
  fireEvent(window, new Event('mela:session-boundary'))
  await act(async () => { finishOldAction() })
  expect(screen.queryByText('Your mentorship change was saved.')).toBeNull()
  expect(screen.queryByDisplayValue('Private academic help')).toBeNull()
})


it('keeps the learner home visible with verified mentor count unavailable when directory fails', async () => {
  mocks.fetchVerifiedMentorsPage.mockRejectedValueOnce(new Error('Mentor search is offline'))
  mocks.fetchMyMentorshipRequests.mockResolvedValueOnce([{
    id:'request-1',mentor_id:'mentor-1',topic:'Career advice',status:'pending',created_at:'2026-10-10T10:00:00Z',
  }])
  render(<Mentorship stageKey="school_11_12" onBack={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', {name: 'Open Mentorship Home'}))
  // Wait for the async directory lookup. The directory card itself has a
  // heading named Mentorship Home before the real dashboard is rendered.
  expect(await screen.findByText(/Verified mentor directory is temporarily unavailable/)).toBeTruthy()
  expect(screen.getByRole('heading',{level:2,name:'Mentorship Home'})).toBeTruthy()
  expect(screen.getByText(/Mentor search is offline/)).toBeTruthy()
  expect(screen.getByText('Career advice')).toBeTruthy()
  expect(screen.getAllByText('Unavailable').length).toBeGreaterThan(0)
  expect(mocks.requestMentor).not.toHaveBeenCalled()
})
