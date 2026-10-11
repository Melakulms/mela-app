import { describe, expect, it } from 'vitest'
import type { Course, Enrollment } from '../src/lib/academy'
import type { PracticeTopic } from '../src/lib/practice'
import { EMPTY_DISCOVERY_PROFILE } from '../src/lib/learner-discovery'
import {
  nearDeadline,
  profilePreparationChecklist,
  recommendCourses,
  recommendPracticeTopics,
} from '../src/lib/personal-learning'

const courses: Course[] = [
  { id:'draft', title:'Computer Science draft', description:'Programming', category:'Technology', level:'beginner', duration_minutes:60, price_cents:0, lesson_count:0, preview_lesson_count:0, content_available:false },
  { id:'free', title:'Computer Science essentials', description:'Learn computing', category:'Technology', level:'beginner', duration_minutes:50, price_cents:0, lesson_count:5, preview_lesson_count:1, content_available:true },
  { id:'paid', title:'Computer Science professional', description:'Advanced skills', category:'Technology', level:'advanced', duration_minutes:60, price_cents:1200, lesson_count:9, preview_lesson_count:0, content_available:true },
  { id:'enrolled', title:'Reading practice', description:'Improve literacy', category:'Languages', level:'beginner', duration_minutes:45, price_cents:0, lesson_count:5, preview_lesson_count:0, content_available:true },
]

describe('personal learning recommendations', () => {
  it('prioritizes real enrolled progress and matched available free lessons, not unavailable drafts or locked payments', () => {
    const enrolled: Enrollment[] = [{ course_id:'enrolled', progress_pct:30, completed_at:null }]
    const rows = recommendCourses(courses, {
      ...EMPTY_DISCOVERY_PROFILE, interest_fields:['computer science'],
    }, new Map(enrolled.map(row => [row.course_id,row])))
    expect(rows[0].course.id).toBe('enrolled')
    expect(rows[0].reasons).toContain('Continue an enrolled course')
    expect(rows.find(row => row.course.id === 'free')!.score).toBeGreaterThan(0)
    expect(rows.find(row => row.course.id === 'paid')!.score).toBe(0)
    expect(rows.find(row => row.course.id === 'draft')!.score).toBe(0)
  })

  it('does not personalize with interests after opting out', () => {
    const ranked = recommendCourses(courses, {
      ...EMPTY_DISCOVERY_PROFILE, interest_fields:['computer science'], enable_suggestions:false,
    }, new Map())
    expect(ranked.every(row => row.score === 0)).toBe(true)
  })

  it('prioritizes actual server-suggested topics and selected school subjects', () => {
    const topics: PracticeTopic[] = [
      { id:'math',subject:'Mathematics',topic:'Fractions',grade_level:'6',description:null },
      { id:'history',subject:'History',topic:'Civilizations',grade_level:'6',description:null },
    ]
    const ranked = recommendPracticeTopics(topics,['History'],['math'])
    expect(ranked[0].topic.id).toBe('math')
    expect(ranked[0].reasons).toContain('Recommended from your existing practice history')
    expect(ranked[1].reasons).toContain('Your selected subject')
  })

  it('uses transparent optional profile steps and does not call them verified', () => {
    const incomplete = profilePreparationChecklist('school_9_10',9,EMPTY_DISCOVERY_PROFILE)
    expect(incomplete.filter(item => item.complete)).toHaveLength(1)
    const complete = profilePreparationChecklist('school_9_10',9,{
      ...EMPTY_DISCOVERY_PROFILE,preferred_program_keys:['g9_math'],
      interest_fields:['Mathematics'],learning_goal:'Become an engineer',target_degree_level:'bachelor',
    })
    expect(complete.every(item => item.complete)).toBe(true)
  })

  it('computes deadline notices from date-only values, ignoring expired and unknown dates', () => {
    expect(nearDeadline('2026-10-12','2026-10-11')).toBe(1)
    expect(nearDeadline('2026-10-25','2026-10-11')).toBe(14)
    expect(nearDeadline('2026-10-26','2026-10-11')).toBe(null)
    expect(nearDeadline('2026-10-10','2026-10-11')).toBe(null)
    expect(nearDeadline(null,'2026-10-11')).toBe(null)
  })
})
