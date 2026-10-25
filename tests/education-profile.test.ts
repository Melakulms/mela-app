import { describe, expect, it } from 'vitest'
import {
  educationChoiceFromStage, educationStageFor, effectiveSchoolTrack,
  isValidSchoolGrade, validateSubjectSelection, allowedSchoolGrades,
} from '../src/lib/education-profile'

describe('mandatory MELA education profile', () => {
  it('requires an explicitly selected stage and grade instead of silently assigning Grade 9', () => {
    expect(educationStageFor('',null)).toBe(null)
    expect(educationStageFor('school',null)).toBe(null)
    expect(educationStageFor('school',9)).toBe('school_9_10')
    expect(educationStageFor('school',1)).toBe('school_1_6')
    expect(educationStageFor('school',8)).toBe('school_7_8')
    expect(educationStageFor('school',12)).toBe('school_11_12')
    for(const bad of [0,13,-1,2.5]) {
      expect(isValidSchoolGrade(bad)).toBe(false)
      expect(educationStageFor('school',bad)).toBe(null)
    }
  })

  it('offers every grade 1 through 12 and maps each deterministically to its curriculum band', () => {
    const allGrades = Array.from({ length: 12 }, (_, index) => index + 1)
    expect(allowedSchoolGrades(null)).toEqual(allGrades)
    const mapping: Record<number, string> = {}
    for (const grade of allGrades) {
      const expectedStage = grade <= 6 ? 'school_1_6' : grade <= 8 ? 'school_7_8' : grade <= 10 ? 'school_9_10' : 'school_11_12'
      expect(educationStageFor('school', grade)).toBe(expectedStage)
      mapping[grade] = expectedStage
    }
    expect(Object.keys(mapping)).toHaveLength(12)
  })

  it('supports existing college/TVET and university education stages without inventing a school grade', () => {
    expect(educationStageFor('college_tvet',null)).toBe('college_tvet')
    expect(educationStageFor('university',null)).toBe('university')
    expect(educationChoiceFromStage('college_tvet')).toBe('college_tvet')
    expect(educationChoiceFromStage('school_1_6')).toBe('school')
    expect(educationChoiceFromStage(null)).toBe('')
  })

  it('requires all core subjects and rejects stale/out-of-catalog selections', () => {
    const catalog=[
      {subject_key:'mathematics',subject_title:'Mathematics',optional:false},
      {subject_key:'english',subject_title:'English',optional:false},
      {subject_key:'art',subject_title:'Art',optional:true},
    ]
    expect(validateSubjectSelection(catalog,[])).toMatch(/Choose/)
    expect(validateSubjectSelection(catalog,['mathematics'])).toMatch(/Required curriculum/)
    expect(validateSubjectSelection(catalog,['english','mathematics'])).toBeNull()
    expect(validateSubjectSelection(catalog,['english','mathematics','art'])).toBeNull()
    expect(validateSubjectSelection(catalog,['english','mathematics','wrong'])).toMatch(/Reload/)
    expect(validateSubjectSelection([],['random'])).toMatch(/No verified/)
  })

  it('only offers senior academic streams for grades 11–12', () => {
    expect(effectiveSchoolTrack(7,'natural_sciences')).toBe('common')
    expect(effectiveSchoolTrack(11,'social_sciences')).toBe('social_sciences')
    expect(effectiveSchoolTrack(12,'not-a-track')).toBe('natural_sciences')
    expect(effectiveSchoolTrack(null,'social_sciences')).toBe('common')
  })
})
