import { describe, expect, it } from 'vitest'
import { telegramRegistrationLink } from '../src/lib/telegram-registration'
import { parseRegistration } from '../supabase/functions/mela-telegram-bot/registration'

describe('Telegram registration binding', () => {
  it.each(['student','parent','teacher','company'])('round trips a %s username including punctuation', role => {
    const link=telegramRegistrationLink(' Student.name-01_2 ',role)!
    const payload=new URL(link).searchParams.get('start')!
    expect(payload.length).toBeLessThanOrEqual(64)
    expect(payload).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(parseRegistration('/start '+payload)).toEqual({username:'student.name-01_2',role})
  })
  it('supports maximum length usernames',()=>{
    const link=telegramRegistrationLink('a'.repeat(32),'company')!
    expect(parseRegistration('/start '+new URL(link).searchParams.get('start'))?.username).toBe('a'.repeat(32))
  })
  it.each(['admin','super_admin','mentor',''])('cannot request privileged role %s',role=>{
    expect(telegramRegistrationLink('learner',role)).toBeNull()
    expect(parseRegistration('/start reg_'+role+'_bGVhcm5lcg')).toBeNull()
  })
  it.each(['ab','a'.repeat(33),'a@example.com','<script>','ሜላ'])('rejects invalid username %s',username=>{
    expect(telegramRegistrationLink(username,'student')).toBeNull()
  })
  it.each(['/start reg_student_@@@','/start reg_student_YWI','/start reg_student_bGVhcm5lcg extra','/register reg_student_bGVhcm5lcg'])('rejects malformed commands: %s',command=>{
    expect(parseRegistration(command)).toBeNull()
  })
})
