// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import PendingEmployerApplication from '../src/pages/PendingEmployerApplication'

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),existing:vi.fn(),insert:vi.fn(),update:vi.fn(),
}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    auth:{getUser:mocks.getUser},
    from:(table:string)=>{
      if(table!=='employer_registration_requests')throw new Error('Unexpected table')
      const q:any={
        select:()=>q,eq:()=>q,order:()=>q,limit:()=>q,
        maybeSingle:()=>mocks.existing(),
        insert:(payload:unknown)=>({select:()=>({single:()=>mocks.insert(payload)})}),
        update:(payload:unknown)=>{
          const u:any={eq:()=>u,select:()=>({maybeSingle:()=>mocks.update(payload)})}
          return u
        },
      }
      return q
    },
  },
}))
beforeEach(()=>{
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'legacy-owner'}},error:null})
  mocks.existing.mockResolvedValue({data:null,error:null})
  mocks.insert.mockResolvedValue({data:{id:'new-req',status:'pending'},error:null})
  mocks.update.mockResolvedValue({data:{id:'existing-req'},error:null})
})
afterEach(cleanup)

it('allows a verified legacy employer to submit a pending request without activating privileges',async()=>{
  render(<PendingEmployerApplication onRefresh={vi.fn()} onSignOut={vi.fn()}/>)
  const company=await screen.findByLabelText('Organization name (required)')
  fireEvent.change(company,{target:{value:'Sample Education Services'}})
  fireEvent.change(screen.getByLabelText('Industry (required)'),{target:{value:'Education'}})
  fireEvent.click(screen.getByRole('button',{name:'Submit organization for review'}))
  await waitFor(()=>expect(mocks.insert).toHaveBeenCalledOnce())
  expect(mocks.insert.mock.calls[0][0]).toMatchObject({
    applicant_user_id:'legacy-owner',company_name:'Sample Education Services',industry:'Education',status:'pending',
  })
  expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('reviewed_by')
  expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('employer_id')
  expect(screen.getByText(/Job posting and access to learners remain disabled/i)).toBeTruthy()
})

it('prevents re-submission after a reviewer starts reviewing',async()=>{
  mocks.existing.mockResolvedValue({data:{
    id:'existing-req',status:'under_review',company_name:'Existing Org',
    legal_name:null,registration_number:null,industry:'Education',website:null,description:null,
  },error:null})
  render(<PendingEmployerApplication onRefresh={vi.fn()} onSignOut={vi.fn()}/>)
  expect(await screen.findByText(/Application status:/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Submit organization for review'})).toBeNull()
  expect(mocks.insert).not.toHaveBeenCalled()
  expect(mocks.update).not.toHaveBeenCalled()
})
