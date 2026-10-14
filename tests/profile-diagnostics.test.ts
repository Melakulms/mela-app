import {beforeEach,expect,it,vi} from 'vitest'
import {inspectMyProfileSetup} from '../src/lib/profile-diagnostics'

const mock=vi.hoisted(()=>({user:vi.fn(),read:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    auth:{getUser:mock.user},
    from:(table:string)=>({select:()=>({eq:()=>({maybeSingle:()=>mock.read(table)})})}),
  },
}))

beforeEach(()=>{
  vi.resetAllMocks()
  mock.user.mockResolvedValue({data:{user:{id:'signed-in-teacher'}},error:null})
})

it('shows a confirmed teacher why question reviewing is not unlocked before qualification submission',async()=>{
  mock.read.mockImplementation(async(table:string)=>table==='profiles'
    ? {data:{role:'teacher',account_status:'active',email_verified:true,role_selected_at:'2026-10-13T19:00:00Z',profile_completion:0},error:null}
    : {data:null,error:null})
  const text=await inspectMyProfileSetup()
  expect(text).toContain('Email verified: yes')
  expect(text).toContain('Profile completion: 0')
  expect(text).toContain('Teaching profile: not submitted')
  expect(text).not.toContain('signed-in-teacher')
})

it('distinguishes a submitted teacher profile from administrator credential approval',async()=>{
  mock.read.mockImplementation(async(table:string)=>table==='profiles'
    ? {data:{role:'teacher',account_status:'active',email_verified:true,role_selected_at:'2026-10-13T19:00:00Z',profile_completion:100},error:null}
    : {data:{subjects_taught:['Mathematics','Physics'],grade_levels:['7','8'],verification_status:'pending'},error:null})
  const text=await inspectMyProfileSetup()
  expect(text).toContain('Teaching profile: submitted')
  expect(text).toContain('Teaching subjects recorded: 2')
  expect(text).toContain('Grade levels recorded: 2')
  expect(text).toContain('Teaching credential review: pending')
  expect(text).not.toContain('Mathematics')
})

it('reports company profile submission without exposing company records',async()=>{
  mock.read.mockImplementation(async(table:string)=>table==='profiles'
    ? {data:{role:'company',account_status:'active',email_verified:true,role_selected_at:'2026-10-13T19:00:00Z',profile_completion:0},error:null}
    : {data:null,error:null})
  const text=await inspectMyProfileSetup()
  expect(text).toContain('Role-specific profile: not submitted')
})
