import { describe,expect,it } from 'vitest'
import { educationReadiness, preliminaryScholarshipMatch, type ScholarshipAcademicProfile } from './scholarship-readiness'
const complete:ScholarshipAcademicProfile = {
  role:'student',full_name:'Example Learner',education_stage_key:'school_11_12',
  education_onboarding_completed:true,grade_level:12,
  major:'Computer Science',graduation_year:2027,email_verified:true,phone_verified:false,
}
describe('scholarship preliminary readiness is not verified eligibility',()=>{
  it('does not claim a match with no profile',()=>{
    const x=preliminaryScholarshipMatch(null,'undergraduate',0)
    expect(x.level).toBe('more_information_needed')
    expect(x.label).not.toContain('eligible')
    expect(educationReadiness(null).completed).toBe(0)
  })
  it('does not recommend university applications to lower school grades',()=>{
    const x=preliminaryScholarshipMatch({...complete,grade_level:6,education_stage_key:'school_1_6'},'undergraduate',0)
    expect(x.level).toBe('explore_only')
  })
  it('does not claim university admission from filled self-reported profile',()=>{
    const x=preliminaryScholarshipMatch(complete,'undergraduate',0)
    expect(x.level).toBe('possibly_relevant')
    expect(x.label).toContain('NOT verified eligible')
    expect(x.reasons).toContain('No academic document has been verified by MELA')
    expect(x.reasons.some(r=>r.includes('Nationality'))).toBe(true)
  })
  it('does not imply a master degree from school education data',()=>{
    const x=preliminaryScholarshipMatch(complete,'masters',0)
    expect(x.level).toBe('more_information_needed')
    expect(x.reasons.some(r=>r.includes('Prior degree'))).toBe(true)
  })
  it('requires meaningful profile before showing even preliminary fit',()=>{
    const x=preliminaryScholarshipMatch({...complete,graduation_year:null,major:null},'undergraduate',1)
    expect(x.level).toBe('more_information_needed')
    expect(educationReadiness({...complete,graduation_year:null,major:null}).completed).toBe(3)
  })
})