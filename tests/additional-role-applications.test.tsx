// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import AdditionalRoleApplications,{csvValues} from '../src/components/AdditionalRoleApplications'

const mocks=vi.hoisted(()=>({getUser:vi.fn(),insertMentor:vi.fn(),insertPartner:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    auth:{getUser:mocks.getUser},
    from:(table:string)=>{
      const query:any={
        select:()=>query,eq:()=>query,order:()=>query,limit:()=>query,
        maybeSingle:async()=>({data:null,error:null}),
        then:(resolve:any)=>Promise.resolve({data:table==='sector_partner_types'?[{partner_type_key:'education',title:'Education'}]:[],error:null}).then(resolve),
        insert:(payload:unknown)=>table==='mentorship_applications'
          ?mocks.insertMentor(payload):mocks.insertPartner(payload),
      }
      return query
    },
  },
}))
beforeEach(()=>{
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'owner-123'}},error:null})
  mocks.insertMentor.mockResolvedValue({error:null})
  mocks.insertPartner.mockResolvedValue({error:null})
})
afterEach(cleanup)

it('removes duplicated empty specialties and limits selection size',()=>{
  expect(csvValues('Math, , Physics, Math',12)).toEqual(['Math','Physics'])
})

it('submits a pending mentor application under the same account, without granting privileges',async()=>{
  render(<AdditionalRoleApplications userId="owner-123"/>)
  await screen.findByText('Mentor application')
  fireEvent.click(screen.getByLabelText(/I confirm I am an adult authorized/))
  fireEvent.change(screen.getByLabelText('Professional title (required)'),{target:{value:'Mathematics educator'}})
  fireEvent.change(screen.getByLabelText('Areas of expertise (comma separated)'),{target:{value:'Mathematics, Exam prep'}})
  fireEvent.change(screen.getByLabelText('Mentoring languages (comma separated)'),{target:{value:'English, Amharic'}})
  fireEvent.change(screen.getByLabelText('Qualifications and relevant experience (required)'),{target:{value:'I have more than ten years of teaching experience.'}})
  fireEvent.click(screen.getByRole('button',{name:'Apply as mentor'}))
  await waitFor(()=>expect(mocks.insertMentor).toHaveBeenCalledOnce())
  expect(mocks.insertMentor).toHaveBeenCalledWith({
    applicant_id:'owner-123',headline:'Mathematics educator',expertise:['Mathematics','Exam prep'],languages:['English','Amharic'],
    background:'I have more than ten years of teaching experience.',status:'pending_review',
  })
  expect(screen.getByText(/No mentor booking rights were granted/)).toBeTruthy()
})

it('refuses additional role application without an eligible adult assertion',async()=>{
  render(<AdditionalRoleApplications userId="owner-123"/>)
  await screen.findByText('Mentor application')
  fireEvent.change(screen.getByLabelText('Professional title (required)'),{target:{value:'Career education specialist'}})
  fireEvent.change(screen.getByLabelText('Areas of expertise (comma separated)'),{target:{value:'Career development'}})
  fireEvent.change(screen.getByLabelText('Mentoring languages (comma separated)'),{target:{value:'Amharic'}})
  fireEvent.change(screen.getByLabelText('Qualifications and relevant experience (required)'),{target:{value:'I have more than ten years of teaching experience.'}})
  fireEvent.click(screen.getByRole('button',{name:'Apply as mentor'}))
  await screen.findByRole('alert')
  expect(mocks.insertMentor).not.toHaveBeenCalled()
})
