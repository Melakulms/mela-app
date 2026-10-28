import type { LanguageCode } from '../i18n'

// Human-facing labels must never expose internal database states.
const requestLabels: Record<'en' | 'am', Record<string,string>> = {
  en: {
    pending: 'Awaiting mentor response',
    accepted: 'Accepted — booking not yet confirmed',
    declined: 'Declined',
    cancelled: 'Cancelled',
    completed: 'Completed',
  },
  am: {
    pending: 'የአማካሪውን ምላሽ በመጠበቅ ላይ',
    accepted: 'ተቀባይነት አግኝቷል — ቀጠሮ ገና አልተረጋገጠም',
    declined: 'ውድቅ ተደርጓል',
    cancelled: 'ተሰርዟል',
    completed: 'ተጠናቋል',
  },
}
const sessionLabels: Record<'en' | 'am', Record<string,string>> = {
  en: { scheduled: 'Booking confirmed', completed: 'Session completed', cancelled: 'Session cancelled' },
  am: { scheduled: 'ቀጠሮው ተረጋግጧል', completed: 'የአማካሪነት ጊዜው ተጠናቋል', cancelled: 'ቀጠሮው ተሰርዟል' },
}
const requestNext: Record<'en' | 'am', Record<string,string>> = {
  en: {
    pending: 'Next: wait for a decision or withdraw the request.',
    accepted: 'Next: your verified mentor must separately confirm a time and session duration. Acceptance is not a booking.',
    declined: 'Next: search for another verified mentor. A decline does not block your learning resources.',
    cancelled: 'Next: browse verified mentors if you still want guidance.',
    completed: 'Next: review any completed session and mentor feedback.',
  },
  am: {
    pending: 'ቀጣይ፦ የአማካሪውን ውሳኔ ይጠብቁ ወይም ጥያቄውን ይሰርዙ።',
    accepted: 'ቀጣይ፦ አማካሪው የቀጠሮውን ጊዜና ቆይታ ለየብቻ ማረጋገጥ አለበት።',
    declined: 'ቀጣይ፦ ሌላ የተረጋገጠ አማካሪ ይፈልጉ።',
    cancelled: 'ቀጣይ፦ እንደገና ምክር ከፈለጉ የተረጋገጡ አማካሪዎችን ያስሱ።',
    completed: 'ቀጣይ፦ የተጠናቀቀውን ቀጠሮና የአማካሪውን አስተያየት ይገምግሙ።',
  },
}
function group(language: LanguageCode): 'en' | 'am' {
  // Amharic is localized here. Other language labels remain clearly written
  // English until reviewed translations are available; do not guess wording.
  return language === 'am' ? 'am' : 'en'
}
export function mentorshipRequestStatus(status: string, language: LanguageCode): string {
  const selected = group(language)
  return requestLabels[selected][status] ?? (selected === 'am' ? 'ያልታወቀ የጥያቄ ሁኔታ' : 'Request status unavailable')
}
export function mentorshipSessionStatus(status: string, language: LanguageCode): string {
  const selected = group(language)
  return sessionLabels[selected][status] ?? (selected === 'am' ? 'ያልታወቀ የቀጠሮ ሁኔታ' : 'Session status unavailable')
}
export function mentorshipRequestNextStep(status: string, language: LanguageCode): string {
  return requestNext[group(language)][status] ?? ''
}
