import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,render,screen} from '@testing-library/react'

vi.mock('../src/lib/role-profile-save',()=>({
  parseSafeList:(raw:string)=>raw.split(',').map(s=>s.trim()).filter(Boolean),
  saveRoleProfile:vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    from:()=>({
      select:()=>({
        eq:()=>({
          order:()=>({
            limit:async()=>({data:[{subject_title:'Mathematics'},{subject_title:'Biology'}],error:null}),
          }),
        }),
      }),
    }),
  },
}))
import FamilyProfileSetup from '../src/pages/FamilyProfileSetup'
import TeacherProfileSetup from '../src/pages/TeacherProfileSetup'
import EmployerProfileSetup from '../src/pages/EmployerProfileSetup'
import {allowedSchoolGrades,canChooseSchoolGrade} from '../src/lib/education-profile'

afterEach(cleanup)

it('keeps family account onboarding separate from teachers and employers',()=>{
  render(<FamilyProfileSetup fullName="Sample Family" email={null} onComplete={()=>{}}/>)
  expect(screen.getByRole('heading',{name:'Family / guardian profile'})).toBeTruthy()
  expect(screen.getByLabelText('How you want to support learning (optional)')).toBeTruthy()
  expect(screen.queryByLabelText('Teaching qualification (required)')).toBeNull()
  expect(screen.queryByLabelText('Industry / sector (required)')).toBeNull()
})
it('requires teacher qualification, institution, subjects and selectable grade permissions',()=>{
  render(<TeacherProfileSetup fullName="Sample Teacher" email={null} onComplete={()=>{}}/>)
  expect(screen.getByRole('heading',{name:'Teacher profile'})).toBeTruthy()
  expect(screen.getByLabelText('Teaching qualification (required)')).toBeTruthy()
  expect(screen.getByLabelText('Grade levels / programs you teach (required)')).toBeTruthy()
  expect(screen.getByRole('button',{name:'Grade 1'})).toBeTruthy()
  expect(screen.getByText(/Saving a profile never grants authority/)).toBeTruthy()
})
it('makes the employer profile independent and does not approve organizations automatically',()=>{
  render(<EmployerProfileSetup role="company" fullName="Sample Employer" email={null} onComplete={()=>{}}/>)
  expect(screen.getByRole('heading',{name:'Employer / organization profile'})).toBeTruthy()
  expect(screen.getByLabelText('Industry / sector (required)')).toBeTruthy()
  expect(screen.getByText(/administrator approval/)).toBeTruthy()
})
it('refuses to misrepresent legacy employer accounts as verified company accounts',()=>{
  render(<EmployerProfileSetup role="employer" fullName="Sample Employer" email={null} onComplete={()=>{}}/>)
  expect(screen.getByRole('alert').textContent).toContain('legacy employer role')
  expect((screen.getByRole('button',{name:'Save employer profile'}) as HTMLButtonElement).disabled).toBe(true)
})
it('restricts selectable grades to the saved stage; permits unfinished but not completed grade edits',()=>{
  expect(allowedSchoolGrades('school_1_6')).toEqual([1,2,3,4,5,6])
  expect(allowedSchoolGrades('school_7_8')).toEqual([7,8])
  expect(allowedSchoolGrades('school_9_10')).toEqual([9,10])
  expect(allowedSchoolGrades('school_11_12')).toEqual([11,12])
  expect(allowedSchoolGrades(null)).toHaveLength(12)
  expect(canChooseSchoolGrade(false)).toBe(true)
  expect(canChooseSchoolGrade(true)).toBe(false)
})

it('shows canonical curriculum subject suggestions without granting teacher review privileges',async()=>{
  render(<TeacherProfileSetup fullName="Test Teacher" email={null} onComplete={()=>{}}/>)
  const picker=await screen.findByLabelText('Add an existing MELA curriculum subject')
  expect((picker as HTMLSelectElement).querySelector('option[value="Mathematics"]')).toBeTruthy()
  expect((picker as HTMLSelectElement).querySelector('option[value="Biology"]')).toBeTruthy()
  expect(screen.getByText(/administrator-verified subjects that match the curriculum/)).toBeTruthy()
})
