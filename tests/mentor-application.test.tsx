import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorApplication from '../src/components/MentorApplication'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  load: vi.fn(),
  insert: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.load }) }),
      insert: mocks.insert,
    }),
  },
}))
beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data:{ user:{ id:'test-student' } }, error:null })
  mocks.load.mockResolvedValue({ data:null,error:null })
  mocks.insert.mockResolvedValue({ error:null })
})
afterEach(cleanup)

describe('MELA adult mentor intake', () => {
  it('shows the separately verified mentor status only when mentor profile is verified and active', async () => {
    mocks.load
      .mockResolvedValueOnce({data:{
        id:'application-2',headline:'Verified mathematics educator',
        expertise:['Math'],languages:['English'],
        background:'Verified independently by administrator',
        status:'reviewed_eligible',submitted_at:'2026-10-27T00:00:00Z',review_notes:null,
      },error:null})
      .mockResolvedValueOnce({data:{verified:true,active:true},error:null})
    render(<MentorApplication />)
    expect(await screen.findByText(/Application: Verified and active mentor/)).toBeTruthy()
  })

  it('records an application without declaring the applicant a verified mentor', async () => {
    render(<MentorApplication/>)
    await screen.findByLabelText('Professional headline')
    fireEvent.change(screen.getByLabelText('Professional headline'), {target:{value:'Engineering educator'}})
    fireEvent.change(screen.getByLabelText('Areas of expertise (comma-separated)'), {target:{value:'Mathematics, AI'}})
    fireEvent.change(screen.getByLabelText('Languages you can mentor in (comma-separated)'), {target:{value:'Amharic, English'}})
    fireEvent.change(screen.getByLabelText('Qualifications and relevant mentoring experience'), {target:{value:'I have worked as an educator in engineering for several years.'}})
    fireEvent.click(screen.getByRole('button', {name:'Submit application for review'}))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledTimes(1))
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({
      applicant_id:'test-student', headline:'Engineering educator',
      expertise:['Mathematics','AI'],languages:['Amharic','English'],
    })
    expect(await screen.findByText(/Application submitted for administrator review/)).toBeTruthy()
    expect(screen.getByText(/You are not yet approved to mentor/)).toBeTruthy()
  })
  it('fails closed when server denies the application', async () => {
    mocks.insert.mockResolvedValueOnce({error:{message:'Adult eligibility not verified'}})
    render(<MentorApplication/>)
    await screen.findByLabelText('Professional headline')
    fireEvent.change(screen.getByLabelText('Professional headline'), {target:{value:'Mathematics teacher'}})
    fireEvent.change(screen.getByLabelText('Areas of expertise (comma-separated)'), {target:{value:'Mathematics'}})
    fireEvent.change(screen.getByLabelText('Languages you can mentor in (comma-separated)'), {target:{value:'English'}})
    fireEvent.change(screen.getByLabelText('Qualifications and relevant mentoring experience'), {target:{value:'Experienced teacher with school math education experience.'}})
    fireEvent.click(screen.getByRole('button', {name:'Submit application for review'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Adult eligibility not verified')
    expect(screen.queryByText(/Application submitted for administrator review/)).toBeNull()
  })
})
