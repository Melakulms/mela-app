import { expect, it } from 'vitest'
import { eligibleSchoolPrograms } from '../src/lib/curriculum-access'
it('rejects a missing grade', () => {
  expect(eligibleSchoolPrograms([], [], null, null, [])).toEqual([])
})
