import { describe, expect, it } from 'vitest'
import { DEFAULT_DEVICE_PREFERENCES, parseDevicePreferences } from '../src/lib/device-preferences'
import { visibleInFocusMode } from '../src/lib/dashboard-focus'

describe('new MELA Settings choices', () => {
  it('loads accent, spacing and focus without losing previous device settings', () => {
    const result = parseDevicePreferences(JSON.stringify({
      theme:'light', largeText:true, reducedMotion:true, lowData:true,
      dailyStudyMinutes:45, accent:'teal', readingSpacing:'relaxed', focusMode:true,
    }))
    expect(result).toMatchObject({
      theme:'light', largeText:true, reducedMotion:true, lowData:true,
      dailyStudyMinutes:45, accent:'teal', readingSpacing:'relaxed', focusMode:true,
    })
  })

  it('migrates existing settings transparently to safe defaults', () => {
    const result = parseDevicePreferences(JSON.stringify({largeText:true,theme:'dark',dailyStudyMinutes:30}))
    expect(result).toMatchObject({largeText:true,theme:'dark',dailyStudyMinutes:30,
      accent:'gold',readingSpacing:'standard',focusMode:false})
  })

  it('rejects malformed or unsafe saved settings without executing arbitrary colors', () => {
    expect(parseDevicePreferences('not json')).toEqual(DEFAULT_DEVICE_PREFERENCES)
    expect(parseDevicePreferences(JSON.stringify({
      accent:'red; background:url(fake)',readingSpacing:'bad',focusMode:'true',dailyStudyMinutes:900,
    }))).toMatchObject({accent:'gold',readingSpacing:'standard',focusMode:false,dailyStudyMinutes:20})
  })

  it('preserves safety, study and profile tools in Focus mode but hides distractions', () => {
    for(const key of ['safety_center','career_passport','academy','practice','question_bank',
      'study_materials','scholarships','mentorship','mastery']) {
      expect(visibleInFocusMode(key,true,false)).toBe(true)
    }
    for(const key of ['arena','wallet','earn_work','challenges']) {
      expect(visibleInFocusMode(key,true,false)).toBe(false)
      expect(visibleInFocusMode(key,true,true)).toBe(true)
      expect(visibleInFocusMode(key,false,false)).toBe(true)
    }
  })
})
