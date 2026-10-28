import type { LanguageCode } from '../i18n'

// Learner-facing copy for the request and session panels (mentorship section 1).
// Amharic strings are drafts and should be reviewed by a native Amharic speaker.
type Lang = 'en' | 'am'
type Copy = Record<string, string>

const en: Copy = {
  requestsTitle: 'My mentorship requests',
  requestsTrack: 'Track actual requests and mentor decisions. Accepted means a mentor agreed to your request; it does not mean a session is confirmed.',
  countPending: 'Awaiting mentor response',
  countAccepted: 'Accepted mentorship requests',
  countFinished: 'Other closed requests',
  countAriaLabel: 'Your request status overview',
  filterLabel: 'Filter my requests',
  filterAll: 'All request statuses',
  filterPending: 'Awaiting mentor response',
  filterAccepted: 'Accepted',
  filterFinished: 'Completed, declined or cancelled',
  filterEmpty: 'No requests match this filter. Choose All request statuses to review your full history.',
  requestedOn: 'Requested',
  preferredTime: 'Preferred time',
  mentorReason: 'Mentor’s reason:',
  viewBookedSessions: 'View my booked sessions',
  findAnotherMentor: 'Find another verified mentor',
  withdrawQuestion: 'Withdraw this pending mentorship request? This cannot be undone.',
  confirmCancelRequest: 'Confirm cancel request',
  keepRequest: 'Keep request',
  cancelRequest: 'Cancel request',
  cancelRequestAria: 'Confirm request cancellation',
  sessionsTitle: 'Your sessions',
  cancelSession: 'Cancel session',
  cancelSessionQuestion: 'Cancel this confirmed appointment? Your mentor will see the change.',
  cancelReasonLabel: 'Reason (optional)',
  confirmCancelSession: 'Confirm cancel session',
  keepSession: 'Keep session',
  cancelSessionAria: 'Confirm session cancellation',
  durationUnknown: 'Duration unavailable',
  minutes: 'minutes',
  followUpNotes: 'Follow-up notes: ',
  rateSession: 'Rate this completed session',
  ratingComment: 'Rating comment (optional)',
  submitRating: 'Submit rating',
  submittingRating: 'Submitting rating…',
  ratedPrefix: 'Rated',
  noSessionsYet: 'No sessions yet. An accepted request is not a booking; your mentor must separately confirm a session within their published available hours.',
  noRequestsYet: 'You have not sent a mentorship request yet.',
  findVerifiedMentor: 'Find a verified mentor',
  mentorAcceptedNoTime: 'Your mentor has accepted. A session time is still to be scheduled.',
  mentorCancelledSession: 'The session was cancelled. Your mentor can schedule a replacement.',
}

const am: Copy = {
  requestsTitle: 'የእኔ የአማካሪነት ጥያቄዎች',
  requestsTrack: 'ያቀረቡትን ጥያቄና የአማካሪዎችን ውሳኔ ይከታተሉ። ተቀባይነት ማለት አማካሪው ጥያቄዎን ተቀብሏል ማለት ነው፤ ቀጠሮው መረጋገጡን አያሳይም።',
  countPending: 'የአማካሪውን ምላሽ በመጠበቅ ላይ',
  countAccepted: 'ተቀባይነት ያገኙ ጥያቄዎች',
  countFinished: 'ሌሎች የተዘጉ ጥያቄዎች',
  countAriaLabel: 'የጥያቄዎችዎ የሁኔታ ማጠቃለያ',
  filterLabel: 'ጥያቄዎቼን አጣራ',
  filterAll: 'ሁሉም የጥያቄ ሁኔታዎች',
  filterPending: 'የአማካሪውን ምላሽ በመጠበቅ ላይ',
  filterAccepted: 'ተቀባይነት አግኝቷል',
  filterFinished: 'የተጠናቀቁ፣ ውድቅ የሆኑ ወይም የተሰረዙ',
  filterEmpty: 'ከዚህ ማጣሪያ ጋር የሚዛመድ ጥያቄ የለም። ሙሉ ታሪክዎን ለማየት «ሁሉም የጥያቄ ሁኔታዎች» ይምረጡ።',
  requestedOn: 'የቀረበበት ቀን',
  preferredTime: 'የተመረጠ ሰዓት',
  mentorReason: 'የአማካሪው ምክንያት፦',
  viewBookedSessions: 'የተያዙ ቀጠሮዎቼን ይመልከቱ',
  findAnotherMentor: 'ሌላ የተረጋገጠ አማካሪ ይፈልጉ',
  withdrawQuestion: 'ይህን በመጠባበቅ ላይ ያለ የአማካሪነት ጥያቄ መሰረዝ ይፈልጋሉ? ይህ ተመልሶ አይቀየርም።',
  confirmCancelRequest: 'ጥያቄውን መሰረዝ አረጋግጥ',
  keepRequest: 'ጥያቄውን አቆይ',
  cancelRequest: 'ጥያቄውን ሰርዝ',
  cancelRequestAria: 'የጥያቄ መሰረዝን አረጋግጥ',
  sessionsTitle: 'የእኔ ቀጠሮዎች',
  cancelSession: 'ቀጠሮውን ሰርዝ',
  cancelSessionQuestion: 'ይህን የተረጋገጠ ቀጠሮ መሰረዝ ይፈልጋሉ? አማካሪዎ ለውጡን ያያል።',
  cancelReasonLabel: 'ምክንያት (አማራጭ)',
  confirmCancelSession: 'ቀጠሮ መሰረዝን አረጋግጥ',
  keepSession: 'ቀጠሮውን አቆይ',
  cancelSessionAria: 'የቀጠሮ መሰረዝን አረጋግጥ',
  durationUnknown: 'የቆይታ ጊዜ አልታወቀም',
  minutes: 'ደቂቃ',
  followUpNotes: 'የክትትል ማስታወሻ፦ ',
  rateSession: 'ይህን የተጠናቀቀ ቀጠሮ ይገምግሙ',
  ratingComment: 'የግምገማ አስተያየት (አማራጭ)',
  submitRating: 'ግምገማ ላክ',
  submittingRating: 'ግምገማ በመላክ ላይ…',
  ratedPrefix: 'የተሰጠ ነጥብ',
  noSessionsYet: 'እስካሁን ቀጠሮ የለም። ተቀባይነት ያገኘ ጥያቄ ቀጠሮ አይደለም፤ አማካሪዎ በታተመው ዝግጁ ሰዓት ውስጥ ቀጠሮውን ለየብቻ ማረጋገጥ አለበት።',
  noRequestsYet: 'እስካሁን የአማካሪነት ጥያቄ አልላኩም።',
  findVerifiedMentor: 'የተረጋገጠ አማካሪ ይፈልጉ',
  mentorAcceptedNoTime: 'አማካሪዎ ጥያቄዎን ተቀብሏል። የቀጠሮ ሰዓቱ ገና አልተያዘም።',
  mentorCancelledSession: 'ቀጠሮው ተሰርዟል። አማካሪዎ ምትክ ቀጠሮ ሊይዝ ይችላል።',
}

const tables: Record<Lang, Copy> = { en, am }

export function learnerCopy(language: LanguageCode | string): Copy {
  return tables[language === 'am' ? 'am' : 'en']
}

// Every key must exist in both languages; checked in tests.
export const LEARNER_COPY_KEYS = Object.keys(en)
