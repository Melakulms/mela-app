import { expect, it } from 'vitest'
import { eligibleSchoolPrograms } from '../src/lib/curriculum-access'
it('rejects a missing grade', () => {
  expect(eligibleSchoolPrograms([], [], null, null, [])).toEqual([])
})

it('filters off-grade and off-catalog subjects', () => {
  const programs = [
    {program_key:'grade1_math',grade_level:1,stage_key:'school_1_6',track_key:'common',subject_key:'mathematics',subject_title:'Mathematics'},
    {program_key:'grade1_bio',grade_level:1,stage_key:'school_1_6',track_key:'common',subject_key:'biology',subject_title:'Biology'},
    {program_key:'grade9_bio',grade_level:9,stage_key:'school_9_10',track_key:'common',subject_key:'biology',subject_title:'Biology'},
  ]
  const subjects=[{stage_key:'school_1_6',track_key:'common',subject_key:'mathematics',optional:false}]
  const result=eligibleSchoolPrograms(programs,subjects,1,'school_1_6',['mathematics'])
  expect(result.map(row=>row.program_key)).toEqual(['grade1_math'])
})

it('requires enrolled senior-stream subjects',()=>{
  const programs=[{program_key:'natural',grade_level:11,stage_key:'school_11_12',track_key:'natural_sciences',subject_key:'biology',subject_title:'Biology'}]
  const catalog=[{stage_key:'school_11_12',track_key:'natural_sciences',subject_key:'biology',optional:false}]
  expect(eligibleSchoolPrograms(programs,catalog,11,'school_11_12',['biology'],'natural_sciences')).toHaveLength(1)
  expect(eligibleSchoolPrograms(programs,catalog,11,'school_11_12',['biology'],null)).toHaveLength(0)
  expect(eligibleSchoolPrograms(programs,catalog,11,'school_11_12',['biology'],'social_sciences')).toHaveLength(0)
  expect(eligibleSchoolPrograms(programs,catalog,11,'school_11_12',['mathematics'],'natural_sciences')).toHaveLength(0)
})

it('prevents mixing questions between grades 1–12',()=>{
  for(let grade=1;grade<=12;grade++){
    const stage=grade<=6?'school_1_6':grade<=8?'school_7_8':grade<=10?'school_9_10':'school_11_12'
    const track=grade>=11?'natural_sciences':'common'
    const programs=[1,2,3,4,5,6,7,8,9,10,11,12].map(g=>({
      program_key:String(g),grade_level:g,stage_key:g<=6?'school_1_6':g<=8?'school_7_8':g<=10?'school_9_10':'school_11_12',
      track_key:g>=11?'natural_sciences':'common',subject_key:'mathematics',subject_title:'Mathematics',
    }))
    const catalog=[{stage_key:stage,track_key:track,subject_key:'mathematics',optional:false}]
    expect(eligibleSchoolPrograms(programs,catalog,grade,stage,['mathematics'],track).map(p=>p.grade_level)).toEqual([grade])
  }
})
