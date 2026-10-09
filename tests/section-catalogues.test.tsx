import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import OpportunityHub from '../src/pages/OpportunityHub'
import SkillAcademy from '../src/pages/SkillAcademy'
const mock = vi.hoisted(() => ({ opportunities: vi.fn(), applications: vi.fn(), apply: vi.fn(), courses: vi.fn(), enrollments: vi.fn(), enroll: vi.fn() }))
vi.mock('../src/lib/opportunities', () => ({ fetchOpenOpportunities: mock.opportunities, fetchMyApplications: mock.applications, applyToOpportunity: mock.apply }))
vi.mock('../src/lib/academy', () => ({ fetchCourses: mock.courses, fetchMyEnrollments: mock.enrollments, enrollInCourse: mock.enroll }))
vi.mock('../src/components/CourseReader', () => ({ default: ({ course }: any) => <h1>Lessons for {course.title}</h1> }))
beforeEach(() => {
  vi.resetAllMocks()
  mock.opportunities.mockResolvedValue([{ id: 'opportunity', title: 'Engineering internship', organization_name: 'Company', opportunity_type: 'internship', location: 'Addis Ababa', is_remote: false, summary: 'Work alongside engineers.', description: 'Build real systems with a team.', requirements: ['Basic programming'], application_instructions: 'Prepare your profile first.', stipend_or_reward: 'Travel support', application_method: 'both', external_url: 'https://example.org/apply', deadline: '2099-12-01' }])
  mock.applications.mockResolvedValue([])
  mock.courses.mockResolvedValue([{ id: 'course', title: 'Career Foundations', category: 'Career', level: 'Beginner', duration_minutes: 45, price_cents: 0 }, { id: 'paid', title: 'Advanced skills', category: 'Skills', price_cents: 100 }])
  mock.enrollments.mockResolvedValue([])
})
afterEach(cleanup)

it('shows full opportunity details, both application methods, and preserves a failed application draft', async () => {
  mock.apply.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(undefined)
  render(<OpportunityHub onBack={vi.fn()} />)
  await screen.findByText('Travel support', { exact: false })
  expect(screen.getByText('Work alongside engineers.')).toBeTruthy()
  expect(screen.getByText('Basic programming')).toBeTruthy()
  expect(screen.getByText('Prepare your profile first.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Official application site' }).getAttribute('href')).toBe('https://example.org/apply')
  fireEvent.click(screen.getByRole('button', { name: 'Apply through MELA' }))
  const note = screen.getByLabelText('Application note (optional)')
  fireEvent.change(note, { target: { value: 'I have relevant experience.' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit application' }))
  await screen.findByRole('alert')
  expect((note as HTMLTextAreaElement).value).toBe('I have relevant experience.')
  fireEvent.click(screen.getByRole('button', { name: 'Submit application' }))
  await screen.findByText('Your application has been submitted.')
  expect(mock.apply).toHaveBeenLastCalledWith('opportunity', 'I have relevant experience.')
})

it('keeps applications to closed opportunities visible in the application history', async () => {
  mock.opportunities.mockResolvedValue([])
  mock.applications.mockResolvedValue([{ id: 'app', opportunity_id: 'closed-opportunity', submitted_at: '2026-10-01', status: 'under_review' }])
  render(<OpportunityHub onBack={vi.fn()} />)
  expect(await screen.findByText('under review')).toBeTruthy()
  expect(screen.getByText('Opportunity reference: closed-opportunity')).toBeTruthy()
})

it('does not offer MELA submission for external, expired or unsupported application methods', async () => {
  mock.opportunities.mockResolvedValue([
    { id: 'a', title: 'External', application_method: 'external', external_url: 'https://example.org' },
    { id: 'b', title: 'Expired', application_method: 'mela', deadline: '2000-01-01' },
    { id: 'c', title: 'Unsupported', application_method: 'unknown' },
  ])
  render(<OpportunityHub onBack={vi.fn()} />)
  await screen.findByText('Applications closed')
  expect(screen.queryByRole('button', { name: 'Apply through MELA' })).toBeNull()
  expect(screen.getByText('Application instructions are not available yet.')).toBeTruthy()
})

it('opens the lesson reader immediately after successful free enrollment', async () => {
  mock.enroll.mockResolvedValue(undefined)
  render(<SkillAcademy onBack={vi.fn()} />)
  await screen.findByText('Career · Beginner · 45 minutes')
  fireEvent.click(screen.getByRole('button', { name: 'Enroll free' }))
  await screen.findByRole('heading', { name: 'Lessons for Career Foundations' })
  expect(mock.enroll).toHaveBeenCalledWith('course')
})

it('filters enrolled courses and keeps paid courses unavailable for purchase', async () => {
  mock.enrollments.mockResolvedValue([{ course_id: 'course', progress_pct: 50, completed_at: null }])
  render(<SkillAcademy onBack={vi.fn()} />)
  await screen.findByText(/purchasing isn't available yet/)
  fireEvent.change(screen.getByLabelText('Show courses'), { target: { value: 'enrolled' } })
  expect(screen.queryByText('Advanced skills')).toBeNull()
  expect(screen.getByRole('button', { name: 'Continue learning' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Search courses'), { target: { value: 'missing' } })
  expect(screen.getByText('No courses match these filters.')).toBeTruthy()
})
