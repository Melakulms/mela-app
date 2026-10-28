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
// Structured decline reasons chosen by mentors. Amharic wording is a first
// draft and must be reviewed by a native speaker before production.
const declineReasonLabels: Record<'en' | 'am', Record<string, string>> = {
  en: {
    schedule_unavailable: 'The mentor is not available at the requested time',
    outside_expertise: 'This topic is outside the mentor’s guidance areas',
    capacity_full: 'The mentor has reached their current capacity',
    different_timing: 'The mentor can help, but needs a different timing',
    other: 'Another reason was given',
  },
  am: {
    schedule_unavailable: 'አማካሪው በተጠየቀው ጊዜ ዝግጁ አይደሉም',
    outside_expertise: 'ይህ ርዕስ ከአማካሪው የመመሪያ መስኮች ውጭ ነው',
    capacity_full: 'አማካሪው አሁን ያላቸው ቀጠሮዎች ሞልተዋል',
    different_timing: 'አማካሪው ሊረዱ ይችላሉ፤ ነገር ግን የተለየ ጊዜ ያስፈልጋቸዋል',
    other: 'ሌላ ምክንያት ተሰጥቷል',
  },
}
export function mentorshipDeclineReason(code: string | null | undefined, language: LanguageCode): string {
  if (!code) return ''
  return declineReasonLabels[group(language)][code] ?? (group(language) === 'am' ? 'ምክንያት ተሰጥቷል' : 'A reason was given')
}
export const DECLINE_REASON_OPTIONS: Record<'en' | 'am', { value: string; label: string }[]> = {
  en: [
    { value: 'schedule_unavailable', label: 'Not available at the requested time' },
    { value: 'outside_expertise', label: 'Outside my guidance areas' },
    { value: 'capacity_full', label: 'At my current capacity' },
    { value: 'different_timing', label: 'Can help, but at a different time' },
    { value: 'other', label: 'Other' },
  ],
  am: [
    { value: 'schedule_unavailable', label: 'በተጠየቀው ጊዜ ዝግጁ አይደለሁም' },
    { value: 'outside_expertise', label: 'ከመመሪያ መስኮቼ ውጭ ነው' },
    { value: 'capacity_full', label: 'አሁን ያለኝ ቀጠሮ ሞልቷል' },
    { value: 'different_timing', label: 'ልረዳ እችላለሁ፤ ግን በሌላ ጊዜ' },
    { value: 'other', label: 'ሌላ' },
  ],
}
