import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PassportRecords from '../src/components/PassportRecords'
import { educationPayload, experiencePayload } from '../src/lib/passport-records'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), insert: vi.fn(), update: vi.fn(), eq: vi.fn(), single: vi.fn(),
  fetchRecords: vi.fn(), saveProject: vi.fn(), saveCareer: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.auth },
    from: () => {
      const query: any = {
        insert: (value: unknown) => { mocks.insert(value); return query },
        update: (value: unknown) => { mocks.update(value); return query },
        eq: (...args: unknown[]) => { mocks.eq(...args); return query },
        select: () => query,
        single: mocks.single,
      }
      return query
    },
  },
}))
vi.mock('../src/lib/passport-records', async (load) => {
  const actual = await load<typeof import('../src/lib/passport-records')>()
  return {
    ...actual,
    fetchPassportRecords: mocks.fetchRecords,
    savePassportProject: mocks.saveProject,
    savePassportCareerRecord: mocks.saveCareer,
  }
})
const education = {
  institution: 'School', qualification: 'Certificate', field_of_study: 'Mathematics',
  start_year: '2023', end_year: '2025', grade: '', is_current: false, description: 'Study',
}
const experience = {
  organization: 'MELA', title: 'Volunteer', experience_type: 'volunteer',
  start_date: '2026-01-01', end_date: '2026-02-01', is_current: false, description: 'Community',
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ data: { user: { id: 'owner' } }, error: null })
  mocks.single.mockResolvedValue({ data: { id: 'saved' }, error: null })
  mocks.fetchRecords.mockResolvedValue([])
  mocks.saveProject.mockResolvedValue({ id: 'p' })
  mocks.saveCareer.mockResolvedValue({ id: 'saved' })
})
afterEach(cleanup)

it('keeps education and experience payloads private without accepting authority fields', () => {
  expect(educationPayload({ ...education, verified: true, user_id: 'victim', is_public: true } as any)).toEqual({
    institution: 'School', qualification: 'Certificate', field_of_study: 'Mathematics',
    start_year: 2023, end_year: 2025, grade: null, is_current: false, description: 'Study', is_public: false,
  })
  expect(experiencePayload({ ...experience, verified: true, is_public: true } as any).is_public).toBe(false)
  expect(() => educationPayload({ ...education, end_year: '2020' })).toThrow(/End year/)
  expect(() => experiencePayload({ ...experience, end_date: '2025-12-31' })).toThrow(/End date/)
  expect(() => experiencePayload({ ...experience, start_date: '2026-02-30' })).toThrow(/valid date/)
})

it('derives owner on insert and filters both user id and record id on update', async () => {
  const { savePassportCareerRecord } = await vi.importActual<typeof import('../src/lib/passport-records')>('../src/lib/passport-records')
  await savePassportCareerRecord('education', { ...education, verified: true } as any)
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'owner', is_public: false }))
  expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('verified')
  mocks.eq.mockClear()
  await savePassportCareerRecord('experience', experience, 'record-id')
  expect(mocks.eq.mock.calls).toEqual([['id', 'record-id'], ['user_id', 'owner']])
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('user_id')
  expect(mocks.update.mock.calls[0][0]).not.toHaveProperty('verified')
})

it('does not show the education editor in production mode', async () => {
  render(<PassportRecords onSaved={vi.fn()} />)
  fireEvent.change(screen.getByLabelText('Record type'), { target: { value: 'education' } })
  await screen.findByText('No education records saved yet.')
  expect(screen.queryByText('Add education record')).toBeNull()
})

it('saves private education in a guarded environment and refreshes the record list', async () => {
  const onSaved = vi.fn()
  render(<PassportRecords onSaved={onSaved} allowCareerEditing />)
  fireEvent.change(screen.getByLabelText('Record type'), { target: { value: 'education' } })
  await screen.findByText('No education records saved yet.')
  fireEvent.click(screen.getByText('Add education record'))
  fireEvent.change(screen.getByLabelText('School or institution'), { target: { value: 'Local school' } })
  fireEvent.click(screen.getByText('Save private record'))
  await waitFor(() => expect(mocks.saveCareer).toHaveBeenCalledWith(
    'education', expect.objectContaining({ institution: 'Local school' }), undefined,
  ))
  await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
})

it('locks verified credentials against student editing', async () => {
  mocks.fetchRecords.mockResolvedValueOnce([]).mockResolvedValueOnce([
    { id: 'v', institution: 'Verified institute', verified: true, is_public: false },
  ])
  render(<PassportRecords onSaved={vi.fn()} allowCareerEditing />)
  fireEvent.change(screen.getByLabelText('Record type'), { target: { value: 'education' } })
  await screen.findByText('Verified institute')
  expect(screen.queryByText('Edit education')).toBeNull()
})

it('forces an existing public project private while employer visibility is unavailable', async () => {
  mocks.fetchRecords.mockResolvedValue([{ id: 'p', title: 'Old public project', is_public: true }])
  render(<PassportRecords onSaved={vi.fn()} allowProjectVisibility={false} />)
  fireEvent.click(await screen.findByText('Edit project'))
  expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(true)
  fireEvent.click(screen.getByText('Save project'))
  await waitFor(() => expect(mocks.saveProject).toHaveBeenCalledWith(
    expect.objectContaining({ is_public: false }), 'p',
  ))
})
