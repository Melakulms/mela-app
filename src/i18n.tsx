import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const SUPPORTED_LANGUAGE_CODES = ['en', 'am', 'om', 'ti', 'so'] as const
export type LanguageCode = (typeof SUPPORTED_LANGUAGE_CODES)[number]

const LANGUAGE_NAME_TO_CODE: Record<string, LanguageCode> = {
  en: 'en', english: 'en',
  am: 'am', amharic: 'am', 'አማርኛ': 'am',
  om: 'om', or: 'om', oromo: 'om', 'afaan oromo': 'om', 'afaan oromoo': 'om',
  ti: 'ti', tigrinya: 'ti', 'ትግርኛ': 'ti',
  so: 'so', somali: 'so', soomaali: 'so',
}

export function normalizeLanguageCode(value: string | null | undefined): LanguageCode {
  const normalized = value?.trim().toLowerCase() ?? ''
  return LANGUAGE_NAME_TO_CODE[normalized] ?? 'en'
}

export type TranslationKey =
  | 'loadingMela'
  | 'loading'
  | 'settingUpAccount'
  | 'sessionRestoreError'
  | 'connectionError'
  | 'profileLoadError'
  | 'unableToLoadAccount'
  | 'retry'
  | 'logout'
  | 'accountUnavailable'
  | 'accountUnavailableHelp'
  | 'languageSaveError'
  | 'skipToContent'
  | 'preferredLanguage'
  | 'connected'
  | 'offline'
  | 'offlineBanner'
  | 'loadingPage'
  | 'centralAdmin'
  | 'centralAdminHelp'
  | 'accountSetup'
  | 'unsupportedRole'
  | 'mainNavigation'
  | 'dashboard'
  | 'practice'
  | 'arena'
  | 'scholarships'
  | 'profile'
  | 'yourDashboard'
  | 'dashboardLoadError'
  | 'tryAgain'
  | 'loadingDashboard'
  | 'learningSpace'
  | 'hello'
  | 'there'
  | 'dailyProgress'
  | 'score'
  | 'badges'
  | 'streak'
  | 'keepMomentum'
  | 'learnToday'
  | 'explorePrompt'
  | 'startPracticing'
  | 'exploreMela'
  | 'exploreMelaHelp'
  | 'findLearningTool'
  | 'searchLearningTools'
  | 'noToolsMatch'
  | 'clearSearch'
  | 'notEnabledYet'
  | 'comingSoon'
  | 'yourBadges'
  | 'badgesLoadError'
  | 'noBadgesYet'
  | 'careerPassport'
  | 'careerPassportBlurb'
  | 'safetyPrivacy'
  | 'safetyPrivacyBlurb'
  | 'opportunityHub'
  | 'opportunityHubBlurb'
  | 'skillAcademy'
  | 'skillAcademyBlurb'
  | 'sponsoredChallenges'
  | 'sponsoredChallengesBlurb'
  | 'aiCareerCoach'
  | 'aiCareerCoachBlurb'
  | 'practiceBlurb'
  | 'questionBank'
  | 'questionBankBlurb'
  | 'arenaBlurb'
  | 'studyMaterials'
  | 'studyMaterialsBlurb'
  | 'ethioScholarConnect'
  | 'ethioScholarConnectBlurb'
  | 'mentorship'
  | 'mentorshipBlurb'
  | 'masteryMap'
  | 'masteryMapBlurb'
  | 'futureMap'
  | 'futureMapBlurb'
  | 'melaNext'
  | 'melaNextBlurb'
  | 'melaWallet'
  | 'melaWalletBlurb'
  | 'verifiedAssessments'
  | 'verifiedAssessmentsBlurb'
  | 'earnWork'
  | 'earnWorkBlurb'
  | 'profileHeading'
  | 'personalInformation'
  | 'name'
  | 'email'
  | 'role'
  | 'coins'
  | 'language'
  | 'connectParent'
  | 'parentLinkHelp'
  | 'generating'
  | 'generateParentLink'
  | 'parentLinkCode'
  | 'back'

const EN: Record<TranslationKey, string> = {
  loadingMela: 'Loading MELA…',
  loading: 'Loading…',
  settingUpAccount: 'Setting up your account…',
  sessionRestoreError: 'Could not restore your session. Please try again.',
  connectionError: 'Could not connect. Please try again.',
  profileLoadError: 'Your profile could not be loaded. Please retry or sign in again.',
  unableToLoadAccount: 'Unable to load your account',
  retry: 'Retry',
  logout: 'Log out',
  accountUnavailable: 'Account unavailable',
  accountUnavailableHelp: 'Contact MELA support for assistance.',
  languageSaveError: 'Could not save your language preference. Please try again.',
  skipToContent: 'Skip to content',
  preferredLanguage: 'Preferred language',
  connected: 'Connected',
  offline: 'Offline',
  offlineBanner: 'You’re offline. Reconnect to load lessons and save your progress.',
  loadingPage: 'Loading your page…',
  centralAdmin: 'Central Admin',
  centralAdminHelp: 'Use the separate MELA Central Dashboard for administrative operations.',
  accountSetup: 'Account setup',
  unsupportedRole: 'Your account role is not yet supported by this frontend.',
  mainNavigation: 'Main navigation',
  dashboard: 'Dashboard',
  practice: 'Practice',
  arena: 'Arena',
  scholarships: 'Scholarships',
  profile: 'Profile',
  yourDashboard: 'Your dashboard',
  dashboardLoadError: 'Could not load your dashboard. Check your connection and try again.',
  tryAgain: 'Try again',
  loadingDashboard: 'Loading your dashboard…',
  learningSpace: 'YOUR LEARNING SPACE',
  hello: 'Hi',
  there: 'there',
  dailyProgress: 'A little progress today. More possibilities tomorrow.',
  score: 'Score',
  badges: 'Badges',
  streak: 'Streak',
  keepMomentum: 'KEEP YOUR MOMENTUM',
  learnToday: 'What will you learn today?',
  explorePrompt: 'Explore your curriculum, sharpen a skill, or discover your next opportunity.',
  startPracticing: 'Start practicing',
  exploreMela: 'Explore MELA',
  exploreMelaHelp: 'Everything you need for your next step.',
  findLearningTool: 'Find a learning tool',
  searchLearningTools: 'Search practice, scholarships, skills…',
  noToolsMatch: 'No tools match',
  clearSearch: 'Clear search',
  notEnabledYet: 'Not enabled yet',
  comingSoon: 'Coming soon',
  yourBadges: 'Your Badges',
  badgesLoadError: 'Your badges couldn’t load.',
  noBadgesYet: 'No badges earned yet — they come from verified skills, courses, and mentorship.',
  careerPassport: 'Career Passport',
  careerPassportBlurb: 'Verified skills, badges & portable identity',
  safetyPrivacy: 'Safety & Privacy',
  safetyPrivacyBlurb: 'Report concerns and manage guardian protection',
  opportunityHub: 'Opportunity Hub',
  opportunityHubBlurb: 'Verified jobs, internships & gigs',
  skillAcademy: 'Skill Academy',
  skillAcademyBlurb: 'Career-tied learning paths',
  sponsoredChallenges: 'Sponsored Challenges',
  sponsoredChallengesBlurb: 'Bank & company competitions',
  aiCareerCoach: 'AI Career Coach',
  aiCareerCoachBlurb: 'Personalized career pathing',
  practiceBlurb: 'Drill curriculum topics',
  questionBank: 'Question Bank',
  questionBankBlurb: 'Access the full grade-matched MELA question bank',
  arenaBlurb: 'Join the arena',
  studyMaterials: 'Study Materials',
  studyMaterialsBlurb: 'Short notes & summaries',
  ethioScholarConnect: 'EthioScholar Connect',
  ethioScholarConnectBlurb: 'Global scholarship discovery',
  mentorship: 'Mentorship',
  mentorshipBlurb: '1:1 mentorship & interview practice',
  masteryMap: 'My Mastery Map',
  masteryMapBlurb: 'See mastered, developing and next skills',
  futureMap: 'My Future Map',
  futureMapBlurb: 'Connect learning to future pathways',
  melaNext: 'Mela Next',
  melaNextBlurb: 'Set and follow your next transition goal',
  melaWallet: 'Mela Wallet',
  melaWalletBlurb: 'Earnings, ledger and payout status',
  verifiedAssessments: 'Verified Assessments',
  verifiedAssessmentsBlurb: 'Skill verification for career readiness',
  earnWork: 'Earn & Work',
  earnWorkBlurb: 'Freelance & escrow tasks',
  profileHeading: 'Your profile',
  personalInformation: 'Personal information',
  name: 'Name',
  email: 'Email',
  role: 'Role',
  coins: 'Coins',
  language: 'Language',
  connectParent: 'Connect a parent or guardian',
  parentLinkHelp: 'Share this code only with your parent or guardian. It expires after 30 minutes. Generating a new code replaces the previous one.',
  generating: 'Generating…',
  generateParentLink: 'Generate parent link code',
  parentLinkCode: 'Parent link code',
  back: 'Back',
}

const TRANSLATIONS: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: EN,
  am: {
    ...EN,
    loadingMela: 'MELA በመጫን ላይ…', loading: 'በመጫን ላይ…', settingUpAccount: 'መለያዎን በማዘጋጀት ላይ…',
    sessionRestoreError: 'ክፍለ ጊዜዎን መመለስ አልተቻለም። እንደገና ይሞክሩ።', connectionError: 'መገናኘት አልተቻለም። እንደገና ይሞክሩ።',
    profileLoadError: 'መገለጫዎን መጫን አልተቻለም። እንደገና ይሞክሩ ወይም ይግቡ።', unableToLoadAccount: 'መለያዎን መጫን አልተቻለም', retry: 'እንደገና ሞክር', logout: 'ውጣ',
    accountUnavailable: 'መለያው አይገኝም', accountUnavailableHelp: 'ለእርዳታ MELA ድጋፍን ያነጋግሩ።', languageSaveError: 'የቋንቋ ምርጫዎን ማስቀመጥ አልተቻለም።',
    skipToContent: 'ወደ ይዘት ዝለል', preferredLanguage: 'የሚመርጡት ቋንቋ', connected: 'ተገናኝቷል', offline: 'ከመስመር ውጭ',
    offlineBanner: 'ከመስመር ውጭ ነዎት። ትምህርቶችን ለመጫን እና ሂደትዎን ለማስቀመጥ እንደገና ይገናኙ።', loadingPage: 'ገጽዎን በመጫን ላይ…',
    centralAdmin: 'ማዕከላዊ አስተዳዳሪ', centralAdminHelp: 'ለአስተዳደር ስራዎች የMELA ማዕከላዊ ዳሽቦርድን ይጠቀሙ።', accountSetup: 'መለያ ማዘጋጀት',
    unsupportedRole: 'የመለያዎ ሚና በዚህ መተግበሪያ ገና አይደገፍም።', mainNavigation: 'ዋና አሰሳ', dashboard: 'ዳሽቦርድ', practice: 'ልምምድ', arena: 'መድረክ', scholarships: 'የትምህርት ዕድሎች', profile: 'መገለጫ',
    yourDashboard: 'የእርስዎ ዳሽቦርድ', dashboardLoadError: 'ዳሽቦርድዎን መጫን አልተቻለም። ግንኙነትዎን ይፈትሹ እና እንደገና ይሞክሩ።', tryAgain: 'እንደገና ይሞክሩ', loadingDashboard: 'ዳሽቦርድዎ በመጫን ላይ…',
    learningSpace: 'የመማሪያ ቦታዎ', hello: 'ሰላም', there: 'ተማሪ', dailyProgress: 'ዛሬ ትንሽ እድገት፤ ነገ ብዙ እድሎች።', score: 'ውጤት', badges: 'ባጆች', streak: 'ተከታታይ',
    keepMomentum: 'ቀጥሉ', learnToday: 'ዛሬ ምን ይማራሉ?', explorePrompt: 'የትምህርት ይዘትዎን ይመርምሩ፣ ክህሎትዎን ያጠናክሩ ወይም ቀጣዩን እድል ያግኙ።', startPracticing: 'ልምምድ ጀምር',
    exploreMela: 'MELAን ያስሱ', exploreMelaHelp: 'ለቀጣዩ እርምጃዎ የሚያስፈልግዎ ሁሉ።', findLearningTool: 'የመማሪያ መሳሪያ ያግኙ', searchLearningTools: 'ልምምድ፣ ስኮላርሺፕ፣ ክህሎት ይፈልጉ…',
    noToolsMatch: 'ምንም መሳሪያ አልተገኘም', clearSearch: 'ፍለጋን አጽዳ', notEnabledYet: 'ገና አልተነቃም', comingSoon: 'በቅርቡ', yourBadges: 'የእርስዎ ባጆች', badgesLoadError: 'ባጆችዎን መጫን አልተቻለም።', noBadgesYet: 'ገና ባጅ አላገኙም — ከተረጋገጡ ክህሎቶች፣ ኮርሶች እና አማካሪነት ይገኛሉ።',
    careerPassport: 'የሙያ ፓስፖርት', careerPassportBlurb: 'የተረጋገጡ ክህሎቶች፣ ባጆች እና ተንቀሳቃሽ መገለጫ', safetyPrivacy: 'ደህንነት እና ግላዊነት', safetyPrivacyBlurb: 'ጉዳዮችን ሪፖርት ያድርጉ እና የአሳዳጊ ጥበቃን ያስተዳድሩ',
    opportunityHub: 'የእድል ማዕከል', opportunityHubBlurb: 'የተረጋገጡ ስራዎች፣ ልምምዶች እና አጭር ስራዎች', skillAcademy: 'የክህሎት አካዳሚ', skillAcademyBlurb: 'ከሙያ ጋር የተያያዙ የመማር መንገዶች',
    sponsoredChallenges: 'የተደገፉ ውድድሮች', sponsoredChallengesBlurb: 'የባንክ እና የኩባንያ ውድድሮች', aiCareerCoach: 'AI የሙያ አሰልጣኝ', aiCareerCoachBlurb: 'ለእርስዎ የተበጀ የሙያ መንገድ',
    practiceBlurb: 'የትምህርት ርዕሶችን ይለማመዱ', questionBank: 'የጥያቄ ባንክ', questionBankBlurb: 'ከክፍልዎ ጋር የሚስማማውን ሙሉ የMELA ጥያቄ ባንክ ይጠቀሙ', arenaBlurb: 'ወደ መድረኩ ይግቡ',
    studyMaterials: 'የጥናት ቁሳቁሶች', studyMaterialsBlurb: 'አጭር ማስታወሻዎች እና ማጠቃለያዎች', ethioScholarConnect: 'EthioScholar Connect', ethioScholarConnectBlurb: 'ዓለም አቀፍ የትምህርት ዕድሎችን ያግኙ',
    mentorship: 'አማካሪነት', mentorshipBlurb: 'አንድ-ለ-አንድ አማካሪነት እና የቃለ መጠይቅ ልምምድ', masteryMap: 'የክህሎት እድገቴ', masteryMapBlurb: 'የተካኑትን፣ በማደግ ላይ ያሉትን እና ቀጣይ ክህሎቶችን ይመልከቱ',
    futureMap: 'የወደፊት መንገዴ', futureMapBlurb: 'ትምህርትን ከወደፊት መንገዶች ጋር ያገናኙ', melaNext: 'Mela Next', melaNextBlurb: 'ቀጣዩን የሽግግር ግብ ያዘጋጁ እና ይከተሉ',
    melaWallet: 'MELA ቦርሳ', melaWalletBlurb: 'ገቢ፣ መዝገብ እና የክፍያ ሁኔታ', verifiedAssessments: 'የተረጋገጡ ግምገማዎች', verifiedAssessmentsBlurb: 'ለሙያ ዝግጁነት የክህሎት ማረጋገጫ',
    earnWork: 'አግኝ እና ስራ', earnWorkBlurb: 'ነፃ ሙያ እና በኤስክሮ የተጠበቁ ስራዎች', profileHeading: 'የእርስዎ መገለጫ', personalInformation: 'የግል መረጃ', name: 'ስም', email: 'ኢሜይል', role: 'ሚና', coins: 'ኮይኖች', language: 'ቋንቋ',
    connectParent: 'ወላጅ ወይም አሳዳጊ ያገናኙ', parentLinkHelp: 'ይህን ኮድ ከወላጅዎ ወይም ከአሳዳጊዎ ጋር ብቻ ያጋሩ። ከ30 ደቂቃ በኋላ ይቃጠላል። አዲስ ኮድ ማመንጨት የቀድሞውን ይተካል።', generating: 'በማመንጨት ላይ…', generateParentLink: 'የወላጅ ማገናኛ ኮድ ፍጠር', parentLinkCode: 'የወላጅ ማገናኛ ኮድ', back: 'ተመለስ',
  },
  om: {
    ...EN,
    loadingMela: 'MELA fe’amaa jira…', loading: 'Fe’amaa jira…', settingUpAccount: 'Herrega kee qopheessaa jirra…',
    sessionRestoreError: 'Yeroo seensaa kee deebisuu hin dandeenye. Irra deebi’ii yaali.', connectionError: 'Wal qunnamuu hin dandeenye. Irra deebi’ii yaali.',
    profileLoadError: 'Profaayila kee fe’uu hin dandeenye. Irra deebi’ii yaali yookaan seeni.', unableToLoadAccount: 'Herrega kee fe’uu hin dandeenye', retry: 'Irra deebi’ii yaali', logout: 'Ba’i',
    accountUnavailable: 'Herregni hin argamu', accountUnavailableHelp: 'Gargaarsaaf deeggarsa MELA qunnami.', languageSaveError: 'Filannoo afaanii kee olkaa’uu hin dandeenye.',
    skipToContent: 'Gara qabiyyeetti darbi', preferredLanguage: 'Afaan filatamaa', connected: 'Walitti hidhame', offline: 'Sarara ala',
    offlineBanner: 'Sarara ala jirta. Barnoota fe’uu fi adeemsa kee olkaa’uuf irra deebi’ii wal qunnami.', loadingPage: 'Fuula kee fe’amaa jira…',
    centralAdmin: 'Bulchaa Giddugaleessaa', centralAdminHelp: 'Hojii bulchiinsaaf Daashboordii Giddugaleessaa MELA fayyadami.', accountSetup: 'Qophii herregaa',
    unsupportedRole: 'Gaheen herrega kee fuuldura kanaan amma hin deeggaramu.', mainNavigation: 'Qajeelfama ijoo', dashboard: 'Daashboordii', practice: 'Shaakala', arena: 'Arena', scholarships: 'Scholarshipoota', profile: 'Profaayilii',
    yourDashboard: 'Daashboordii kee', dashboardLoadError: 'Daashboordii kee feʼuu hin dandeenye. Quunnamtii kee ilaaliitii irra deebiʼii yaali.', tryAgain: 'Irra deebiʼii yaali', loadingDashboard: 'Daashboordiin kee feʼamaa jira…',
    learningSpace: 'IDDOO BARNOOTAA KEE', hello: 'Akkam', there: 'barataa', dailyProgress: 'Harʼa tarkaanfii xiqqoo; bor carraa dabalataa.', score: 'Qabxii', badges: 'Baajota', streak: 'Walitti fufiinsa',
    keepMomentum: 'ITTI FUFI', learnToday: 'Harʼa maal baratta?', explorePrompt: 'Barnoota kee qoradhu, dandeettii cimsadhu, yookaan carraa itti aanu argadhu.', startPracticing: 'Shaakala jalqabi',
    exploreMela: 'MELA qoradhu', exploreMelaHelp: 'Tarkaanfii itti aanuuf waan si barbaachisu hunda.', findLearningTool: 'Meeshaa barnootaa barbaadi', searchLearningTools: 'Shaakala, scholarship, dandeettii barbaadi…',
    noToolsMatch: 'Meeshaan walsimu hin jiru', clearSearch: 'Barbaacha qulqulleessi', notEnabledYet: 'Amma hin hojjatu', comingSoon: 'Dhiheenyatti', yourBadges: 'Baajota Kee', badgesLoadError: 'Baajota kee feʼuu hin dandeenye.', noBadgesYet: 'Amma baajii hin arganne — dandeettii mirkanaaʼe, koorsii fi mentorship irraa argatta.',
    careerPassport: 'Paaspoortii Hojii', careerPassportBlurb: 'Dandeettii mirkanaaʼe, baajota fi eenyummaa sochoʼaa', safetyPrivacy: 'Nageenya fi Iccitii', safetyPrivacyBlurb: 'Yaaddoo gabaasi, eegumsa maatii bulchi',
    opportunityHub: 'Wiirtuu Carraa', opportunityHubBlurb: 'Hojii, internship fi hojii gabaabaa mirkanaaʼe', skillAcademy: 'Akkaadaamii Dandeettii', skillAcademyBlurb: 'Daandii barnootaa hojii waliin walqabatu',
    sponsoredChallenges: 'Qormaata Deeggarame', sponsoredChallengesBlurb: 'Dorgommii baankii fi dhaabbataa', aiCareerCoach: 'Leenjisaa Hojii AI', aiCareerCoachBlurb: 'Daandii hojii dhuunfaa',
    practiceBlurb: 'Mata dureewwan barnootaa shaakali', questionBank: 'Kuusaa Gaaffii', questionBankBlurb: 'Kuusaa gaaffii MELA kutaa keetiin walsimu guutuu fayyadami', arenaBlurb: 'Gara Arena seeni',
    studyMaterials: 'Meeshaalee Qoʼannaa', studyMaterialsBlurb: 'Yaadannoo gabaabaa fi cuunfaa', ethioScholarConnect: 'EthioScholar Connect', ethioScholarConnectBlurb: 'Scholarship addunyaa barbaadi',
    mentorship: 'Mentorship', mentorshipBlurb: 'Mentorship nama tokkoo fi shaakala interview', masteryMap: 'Kaartaa Dandeettii Koo', masteryMapBlurb: 'Dandeettii xumurame, guddachaa jiru fi itti aanu ilaali',
    futureMap: 'Kaartaa Fuulduraa Koo', futureMapBlurb: 'Barnoota daandii fuulduraa waliin walqabsiisi', melaNext: 'Mela Next', melaNextBlurb: 'Galma ceʼumsaa itti aanu kaaʼii hordofi',
    melaWallet: 'Mela Wallet', melaWalletBlurb: 'Galii, galmee fi haala kaffaltii', verifiedAssessments: 'Madaallii Mirkanaaʼe', verifiedAssessmentsBlurb: 'Qophii hojii irratti dandeettii mirkaneessi',
    earnWork: 'Argadhu fi Hojjedhu', earnWorkBlurb: 'Hojii freelance fi escrow', profileHeading: 'Profaayila kee', personalInformation: 'Odeeffannoo dhuunfaa', name: 'Maqaa', email: 'Imeelii', role: 'Gahee', coins: 'Kooyinii', language: 'Afaan',
    connectParent: 'Maatii yookaan eegduu walqabsiisi', parentLinkHelp: 'Koodii kana maatii yookaan eegduu kee qofaaf qoodi. Daqiiqaa 30 booda ni dhuma. Koodii haaraa uumuun kan duraa bakka buusa.', generating: 'Uumamaa jira…', generateParentLink: 'Koodii walqabsiisaa maatii uumi', parentLinkCode: 'Koodii walqabsiisaa maatii', back: 'Duubatti',
  },
  ti: {
    ...EN,
    loadingMela: 'MELA ይጽዕን ኣሎ…', loading: 'ይጽዕን ኣሎ…', settingUpAccount: 'መለያኻ ነዳሉ ኣለና…',
    sessionRestoreError: 'ክፍለ ግዜኻ ክንመልስ ኣይከኣልናን። እንደገና ፈትን።', connectionError: 'ክንራኸብ ኣይከኣልናን። እንደገና ፈትን።',
    profileLoadError: 'ፕሮፋይልካ ክጽዕን ኣይከኣለን። እንደገና ፈትን ወይ እቶ።', unableToLoadAccount: 'መለያኻ ክጽዕን ኣይከኣለን', retry: 'እንደገና ፈትን', logout: 'ውጻእ',
    accountUnavailable: 'መለያ ኣይርከብን', accountUnavailableHelp: 'ንሓገዝ ደገፍ MELA ተወከስ።', languageSaveError: 'ምርጫ ቋንቋኻ ክዕቀብ ኣይከኣለን።',
    skipToContent: 'ናብ ትሕዝቶ ዝለል', preferredLanguage: 'ዝመረጽካዮ ቋንቋ', connected: 'ተራኺቡ', offline: 'ካብ መስመር ወጻኢ',
    offlineBanner: 'ካብ መስመር ወጻኢ ኢኻ። ትምህርቲ ንምጽዓንን ምዕባለኻ ንምዕቃብን ዳግማይ ተራኸብ።', loadingPage: 'ገጽካ ይጽዕን ኣሎ…',
    centralAdmin: 'ማእከላይ ኣስተዳዳሪ', centralAdminHelp: 'ንምምሕዳር ስራሕ ዝተፈለየ MELA Central Dashboard ተጠቐም።', accountSetup: 'ምድላው መለያ',
    unsupportedRole: 'ተራ መለያኻ ብዚ ፊት-ገጽ ገና ኣይድገፍን።', mainNavigation: 'ቀንዲ ኣሰሳ', dashboard: 'ዳሽቦርድ', practice: 'ልምምድ', arena: 'መድረኽ', scholarships: 'ስኮላርሺፕ', profile: 'ፕሮፋይል',
    yourDashboard: 'ዳሽቦርድካ', dashboardLoadError: 'ዳሽቦርድካ ክጽዕን ኣይከኣለን። ምትእስሳርካ ፈትሽ እና ደጊምካ ፈትን።', tryAgain: 'ደጊምካ ፈትን', loadingDashboard: 'ዳሽቦርድካ ይጽዕን ኣሎ…',
    learningSpace: 'ቦታ ትምህርትካ', hello: 'ሰላም', there: 'ተማሃራይ', dailyProgress: 'ሎሚ ንእሽቶ ምዕባለ፤ ጽባሕ ብዙሕ ዕድላት።', score: 'ነጥቢ', badges: 'ባጆች', streak: 'ተኸታታሊ',
    keepMomentum: 'ቀጽል', learnToday: 'ሎሚ እንታይ ክትመሃር ኢኻ?', explorePrompt: 'ትምህርትካ መርምር፣ ክእለትካ ኣሐይል፣ ወይ ቀጻሊ ዕድልካ ርኸብ።', startPracticing: 'ልምምድ ጀምር',
    exploreMela: 'MELA መርምር', exploreMelaHelp: 'ንቀጻሊ ስጉምትኻ ዘድልየካ ኩሉ።', findLearningTool: 'መሳርሒ ትምህርቲ ድለ', searchLearningTools: 'ልምምድ፣ ስኮላርሺፕ፣ ክእለት ድለ…',
    noToolsMatch: 'ዝሰማማዕ መሳርሒ የለን', clearSearch: 'ድለያ ኣጽሪ', notEnabledYet: 'ገና ኣይተኸፍተን', comingSoon: 'ኣብ ቀረባ', yourBadges: 'ባጆችካ', badgesLoadError: 'ባጆችካ ክጽዕኑ ኣይከኣሉን።', noBadgesYet: 'ገና ባጅ ኣይረኸብካን — ካብ ዝተረጋገጹ ክእለታት፣ ኮርሳትን ምኽርን ይመጹ።',
    careerPassport: 'ፓስፖርት ሞያ', careerPassportBlurb: 'ዝተረጋገጹ ክእለታት፣ ባጆችን ተንቀሳቓሲ መንነትን', safetyPrivacy: 'ድሕነትን ምስጢርን', safetyPrivacyBlurb: 'ጉዳያት ሪፖርት ግበር እና ምክልኻል ኣላዪ ኣመሓድር',
    opportunityHub: 'ማእከል ዕድላት', opportunityHubBlurb: 'ዝተረጋገጹ ስራሕ፣ ልምምድን ጊግን', skillAcademy: 'ኣካዳሚ ክእለት', skillAcademyBlurb: 'ምስ ሞያ ዝተኣሳሰሩ መንገዲ ትምህርቲ',
    sponsoredChallenges: 'ዝተደገፉ ብድሆታት', sponsoredChallengesBlurb: 'ውድድር ባንክን ኩባንያን', aiCareerCoach: 'AI ኣሰልጣኒ ሞያ', aiCareerCoachBlurb: 'ንዓኻ ዝተበጀወ መንገዲ ሞያ',
    practiceBlurb: 'ኣርእስቲ ትምህርቲ ልምምድ ግበር', questionBank: 'ባንኪ ሕቶ', questionBankBlurb: 'ምስ ክፍልካ ዝሰማማዕ ሙሉእ ባንኪ ሕቶ MELA ተጠቐም', arenaBlurb: 'ናብ መድረኽ እቶ',
    studyMaterials: 'መሳርሒ መጽናዕቲ', studyMaterialsBlurb: 'ሓጺር ማስታወሻን ጽማቝን', ethioScholarConnect: 'EthioScholar Connect', ethioScholarConnectBlurb: 'ዓለምለኻዊ ስኮላርሺፕ ድለ',
    mentorship: 'ምኽሪ', mentorshipBlurb: 'ንሓደ-ንሓደ ምኽሪን ልምምድ ቃለ-መጠይቕን', masteryMap: 'ካርታ ክእለተይ', masteryMapBlurb: 'ዝተማለኹ፣ ዝምዕብሉን ቀጻሊ ክእለታትን ርአ',
    futureMap: 'ካርታ መጻኢየይ', futureMapBlurb: 'ትምህርቲ ምስ መንገዲ መጻኢ ኣተኣሳስር', melaNext: 'Mela Next', melaNextBlurb: 'ቀጻሊ ዕላማ ምስግጋር ኣቐምጥ እና ተኸተል',
    melaWallet: 'Mela Wallet', melaWalletBlurb: 'እቶት፣ መዝገብን ኩነታት ክፍሊትን', verifiedAssessments: 'ዝተረጋገጹ ግምገማታት', verifiedAssessmentsBlurb: 'ንድሉውነት ሞያ ክእለት ኣረጋግጽ',
    earnWork: 'ኣርክብ እና ስራሕ', earnWorkBlurb: 'ፍሪላንስን ኤስክሮ ስራሕን', profileHeading: 'ፕሮፋይልካ', personalInformation: 'ውልቃዊ ሓበሬታ', name: 'ስም', email: 'ኢሜይል', role: 'ተራ', coins: 'ኮይን', language: 'ቋንቋ',
    connectParent: 'ወላዲ ወይ ኣላዪ ኣራኽብ', parentLinkHelp: 'እዚ ኮድ ምስ ወላዲኻ ወይ ኣላዪኻ ጥራይ ኣካፍል። ድሕሪ 30 ደቒቕ ይውዳእ። ሓድሽ ኮድ ምፍጣር ነቲ ቀዳማይ ይትክኦ።', generating: 'ይፍጠር ኣሎ…', generateParentLink: 'ኮድ መራኸቢ ወላዲ ፍጠር', parentLinkCode: 'ኮድ መራኸቢ ወላዲ', back: 'ተመለስ',
  },
  so: {
    ...EN,
    loadingMela: 'MELA waa la soo dejinayaa…', loading: 'Waa la soo dejinayaa…', settingUpAccount: 'Akoonkaaga waa la diyaarinayaa…',
    sessionRestoreError: 'Fadhigaaga lama soo celin karin. Isku day mar kale.', connectionError: 'Lama xiriiri karin. Isku day mar kale.',
    profileLoadError: 'Boggaaga lama soo dejin karin. Isku day mar kale ama dib u gal.', unableToLoadAccount: 'Akoonkaaga lama soo dejin karin', retry: 'Isku day mar kale', logout: 'Ka bax',
    accountUnavailable: 'Akoonku ma shaqaynayo', accountUnavailableHelp: 'La xiriir taageerada MELA si laguu caawiyo.', languageSaveError: 'Luqadda aad dooratay lama kaydin karin.',
    skipToContent: 'U gudub nuxurka', preferredLanguage: 'Luqadda la doorbiday', connected: 'Ku xiran', offline: 'Khad la’aan',
    offlineBanner: 'Waxaad ku jirtaa khad la’aan. Dib ugu xidh internetka si aad u soo dejiso casharrada oo aad u kaydiso horumarkaaga.', loadingPage: 'Boggaaga waa la soo dejinayaa…',
    centralAdmin: 'Maamulka Dhexe', centralAdminHelp: 'Hawlaha maamulka u isticmaal MELA Central Dashboard.', accountSetup: 'Diyaarinta akoonka',
    unsupportedRole: 'Doorka akoonkaaga weli laguma taageero qaybtaan.', mainNavigation: 'Hagidda ugu weyn', dashboard: 'Bogga guud', practice: 'Tababar', arena: 'Arena', scholarships: 'Deeqo waxbarasho', profile: 'Boggaaga',
    yourDashboard: 'Boggaaga guud', dashboardLoadError: 'Boggaaga guud lama soo dejin karin. Hubi xiriirkaaga oo isku day mar kale.', tryAgain: 'Isku day mar kale', loadingDashboard: 'Boggaaga guud waa la soo dejinayaa…',
    learningSpace: 'GOOBTA BARASHADAADA', hello: 'Salaan', there: 'arday', dailyProgress: 'Horumar yar maanta. Fursado badan berri.', score: 'Dhibco', badges: 'Calaamado', streak: 'Joogteyn',
    keepMomentum: 'SII WAD', learnToday: 'Maxaad maanta baran doontaa?', explorePrompt: 'Sahami manhajkaaga, xooji xirfad, ama hel fursaddaada xigta.', startPracticing: 'Bilow tababarka',
    exploreMela: 'Sahami MELA', exploreMelaHelp: 'Wax kasta oo aad u baahan tahay tallaabadaada xigta.', findLearningTool: 'Raadi qalab waxbarasho', searchLearningTools: 'Raadi tababar, deeqo, xirfado…',
    noToolsMatch: 'Qalab ku habboon lama helin', clearSearch: 'Nadiifi raadinta', notEnabledYet: 'Weli lama hawlgelin', comingSoon: 'Dhawaan', yourBadges: 'Calaamadahaaga', badgesLoadError: 'Calaamadahaaga lama soo dejin karin.', noBadgesYet: 'Weli calaamad ma aadan helin — waxay ka yimaadaan xirfado la xaqiijiyay, koorsooyin iyo hagid.',
    careerPassport: 'Baasaboorka Xirfadda', careerPassportBlurb: 'Xirfado la xaqiijiyay, calaamado iyo aqoonsi la qaadan karo', safetyPrivacy: 'Badbaado & Asturnaan', safetyPrivacyBlurb: 'Soo sheeg walaacyada oo maamul ilaalinta masuulka',
    opportunityHub: 'Xarunta Fursadaha', opportunityHubBlurb: 'Shaqooyin, layliyo iyo gigs la xaqiijiyay', skillAcademy: 'Akadeemiyadda Xirfadaha', skillAcademyBlurb: 'Waddooyin waxbarasho oo xirfad ku xiran',
    sponsoredChallenges: 'Tartamo La Taageeray', sponsoredChallengesBlurb: 'Tartamada bangiyada iyo shirkadaha', aiCareerCoach: 'Tababaraha Xirfadda AI', aiCareerCoachBlurb: 'Jid xirfadeed kuu gaar ah',
    practiceBlurb: 'Ku celceli mawduucyada manhajka', questionBank: 'Kaydka Suʼaalaha', questionBankBlurb: 'Hel kaydka suʼaalaha MELA ee ku habboon fasalkaaga', arenaBlurb: 'Ku biir Arena',
    studyMaterials: 'Agabka Waxbarashada', studyMaterialsBlurb: 'Qoraallo gaagaaban iyo soo koobid', ethioScholarConnect: 'EthioScholar Connect', ethioScholarConnectBlurb: 'Raadi deeqaha waxbarasho ee caalamka',
    mentorship: 'Hagid', mentorshipBlurb: 'Hagid qof-qof ah iyo tababar wareysi', masteryMap: 'Khariidadda Xirfaddayda', masteryMapBlurb: 'Arag xirfadaha aad taqaan, kuwa kobcaya iyo kuwa xiga',
    futureMap: 'Khariidadda Mustaqbalkayga', futureMapBlurb: 'Ku xiro waxbarashada waddooyinka mustaqbalka', melaNext: 'Mela Next', melaNextBlurb: 'Deji oo raac yoolkaaga kala-guurka xiga',
    melaWallet: 'Mela Wallet', melaWalletBlurb: 'Dakhli, diiwaan iyo xaaladda bixinta', verifiedAssessments: 'Qiimeyn La Xaqiijiyay', verifiedAssessmentsBlurb: 'Xaqiiji xirfadaha diyaar-garowga shaqada',
    earnWork: 'Kasbo & Shaqee', earnWorkBlurb: 'Hawlo freelance iyo escrow', profileHeading: 'Boggaaga', personalInformation: 'Macluumaad shaqsiyeed', name: 'Magac', email: 'Iimayl', role: 'Door', coins: 'Qadaadiic', language: 'Luqad',
    connectParent: 'Ku xiro waalid ama masuul', parentLinkHelp: 'Koodhkan la wadaag waalidkaaga ama masuulkaaga oo keliya. Wuxuu dhacayaa 30 daqiiqo kadib. Samaynta koodh cusub waxay beddeshaa kii hore.', generating: 'Waa la samaynayaa…', generateParentLink: 'Samee koodhka isku xirka waalidka', parentLinkCode: 'Koodhka isku xirka waalidka', back: 'Dib u noqo',
  },
}

type I18nContextValue = {
  language: LanguageCode
  setLanguage: (value: string) => void
  t: (key: TranslationKey) => string
}

export function translate(language: LanguageCode, key: TranslationKey): string {
  return TRANSLATIONS[language][key] ?? EN[key]
}

const I18nContext = createContext<I18nContextValue>({ language: 'en', setLanguage: () => {}, t: (key) => translate('en', key) })

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageCode] = useState<LanguageCode>(() => normalizeLanguageCode(localStorage.getItem('mela_language')))
  const setLanguage = useCallback((value: string) => {
    const next = normalizeLanguageCode(value)
    setLanguageCode(next)
    localStorage.setItem('mela_language', next)
  }, [])
  useEffect(() => { document.documentElement.lang = language }, [language])
  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (key) => translate(language, key),
  }), [language, setLanguage])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() { return useContext(I18nContext) }
