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
