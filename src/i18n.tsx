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
  },
}

type I18nContextValue = {
  language: LanguageCode
  setLanguage: (value: string) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue>({ language: 'en', setLanguage: () => {}, t: (key) => EN[key] })

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
    t: (key) => TRANSLATIONS[language][key] ?? EN[key],
  }), [language, setLanguage])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() { return useContext(I18nContext) }
