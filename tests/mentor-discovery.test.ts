import { describe, expect, it } from 'vitest'
import type { Mentor } from '../src/lib/mentorship'
import { discoverMentors, getMentorLanguages, isValidAvailabilitySlot, mentorMatchesCategory } from '../src/lib/mentor-discovery'

const mentor = (overrides: Partial<Mentor> = {}): Mentor => ({
  user_id: 'verified-1', full_name: 'Abebe Tadesse', headline: 'Engineering mentor',
  bio: 'Supports software programming careers', organization: 'University',
  years_experience: 5, rating_average: 4.8, rating_count: 5,
  expertise: ['Software engineering', 'AI'], languages: ['Amharic', 'English'],
  availability: [], ...overrides,
})

describe('mentorship discovery (verified profiles only, supplied by the server)', () => {
  it('matches actual published weekday hours rather than assuming all mentors are bookable',()=>{
    const monday = mentor({user_id:'monday',availability:[{
      id:'slot-1',weekday:1,start_time:'09:00',end_time:'10:00',timezone:'Africa/Addis_Ababa',
    }]})
    const empty = mentor({user_id:'none',availability:[]})
    expect(discoverMentors([monday,empty],{
      query:'',category:'all',language:'',weekday:1,
    }).map(x=>x.user_id)).toEqual(['monday'])
    expect(discoverMentors([monday,empty],{
      query:'',category:'all',language:'',weekday:5,
    })).toEqual([])
    expect(discoverMentors([monday,empty],{
      query:'',category:'all',language:'',onlyWithAvailability:true,
    }).map(x=>x.user_id)).toEqual(['monday'])
  })
  it('sorts genuine session ratings above unrated profiles without inventing score',()=>{
    const unrated=mentor({user_id:'unrated',rating_average:0,rating_count:0})
    const rated=mentor({user_id:'rated',rating_average:4.1,rating_count:10})
    const higher=mentor({user_id:'high',rating_average:4.8,rating_count:2})
    expect(discoverMentors([unrated,rated,higher],{
      query:'',category:'all',language:'',sort:'rated',
    }).map(x=>x.user_id)).toEqual(['high','rated','unrated'])
  })
  it('uses actual years-of-experience values for optional comparison',()=>{
    const unknown=mentor({user_id:'unknown',years_experience:null})
    const senior=mentor({user_id:'senior',years_experience:15})
    const junior=mentor({user_id:'junior',years_experience:2})
    expect(discoverMentors([unknown,junior,senior],{
      query:'',category:'all',language:'',sort:'experience',
    }).map(x=>x.user_id)).toEqual(['senior','junior','unknown'])
  })

  it('matches expertise and language without relying on inferred or fake mentors', () => {
    const mentors = [
      mentor(),
      mentor({ user_id: '2', full_name: 'Birtukan', expertise: ['Marketing'], headline: 'Business adviser', bio: null, languages: ['Afaan Oromo'] }),
    ]
    expect(discoverMentors(mentors, { query: 'AI', category: 'technology', language: 'English' }).map((m) => m.user_id)).toEqual(['verified-1'])
    expect(discoverMentors(mentors, { query: '', category: 'business', language: 'English' })).toEqual([])
  })
  it('treats AI as a distinct term, not a substring of unrelated words', () => {
    expect(mentorMatchesCategory(mentor({ expertise: [], headline: 'Painting', bio: null }), 'technology')).toBe(false)
    expect(mentorMatchesCategory(mentor({ expertise: ['AI'], headline: null, bio: null }), 'technology')).toBe(true)
  })
  it('supports multiple search terms with real profile text', () => {
    expect(discoverMentors([mentor()], { query: 'abebe software', category: 'all', language: '' })).toHaveLength(1)
  })
  it('offers only actually listed languages', () => {
    expect(getMentorLanguages([mentor(), mentor({ languages: ['English', 'Somali'] })])).toEqual(['Amharic', 'English', 'Somali'])
  })
  it('rejects invalid availability windows before writing', () => {
    expect(isValidAvailabilitySlot(1, '09:00', '12:00')).toBe(true)
    expect(isValidAvailabilitySlot(7, '09:00', '12:00')).toBe(false)
    expect(isValidAvailabilitySlot(1, '12:00', '09:00')).toBe(false)
    expect(isValidAvailabilitySlot(1, '08:67', '09:00')).toBe(false)
  })
})
