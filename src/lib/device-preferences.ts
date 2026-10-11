export type ThemeMode = 'system' | 'dark' | 'light'
export type AccentColor = 'gold' | 'teal' | 'violet' | 'coral'
export type ReadingSpacing = 'standard' | 'relaxed' | 'compact'

export type DevicePreferences = {
  theme: ThemeMode
  accent: AccentColor
  readingSpacing: ReadingSpacing
  focusMode: boolean
  largeText: boolean
  highContrast: boolean
  reducedMotion: boolean
  lowData: boolean
  dailyStudyMinutes: number
}

export const DEVICE_PREFERENCES_KEY = 'mela_device_preferences_v1'

export const DEFAULT_DEVICE_PREFERENCES: DevicePreferences = {
  theme: 'system',
  accent: 'gold',
  readingSpacing: 'standard',
  focusMode: false,
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  lowData: false,
  dailyStudyMinutes: 20,
}

export function parseDevicePreferences(raw: string | null): DevicePreferences {
  try {
    const value = JSON.parse(raw || '{}') as Record<string, unknown>
    const minutes = Number(value.dailyStudyMinutes)
    return {
      theme: value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system',
      accent: value.accent === 'teal' || value.accent === 'violet' || value.accent === 'coral' ? value.accent : 'gold',
      readingSpacing: value.readingSpacing === 'compact' || value.readingSpacing === 'relaxed' ? value.readingSpacing : 'standard',
      focusMode: value.focusMode === true,
      largeText: value.largeText === true,
      highContrast: value.highContrast === true,
      reducedMotion: value.reducedMotion === true,
      lowData: value.lowData === true,
      dailyStudyMinutes: Number.isInteger(minutes) && minutes >= 5 && minutes <= 240 ? minutes : 20,
    }
  } catch {
    return { ...DEFAULT_DEVICE_PREFERENCES }
  }
}

export function readDevicePreferences(): DevicePreferences {
  try { return parseDevicePreferences(localStorage.getItem(DEVICE_PREFERENCES_KEY)) }
  catch { return { ...DEFAULT_DEVICE_PREFERENCES } }
}

export function applyDevicePreferences(value: DevicePreferences) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.melaTheme = value.theme
  root.dataset.melaAccent = value.accent
  root.dataset.melaReading = value.readingSpacing
  root.classList.toggle('mela-focus-mode', value.focusMode)
  root.classList.toggle('mela-large-text', value.largeText)
  root.classList.toggle('mela-high-contrast', value.highContrast)
  root.classList.toggle('mela-reduced-motion', value.reducedMotion)
  root.classList.toggle('mela-low-data', value.lowData)
}

export function saveDevicePreferences(value: DevicePreferences): boolean {
  applyDevicePreferences(value)
  let persisted = false
  try {
    localStorage.setItem(DEVICE_PREFERENCES_KEY, JSON.stringify(value))
    persisted = true
  } catch { /* Apply for this session only if storage is unavailable. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('mela:device-preferences-changed'))
  return persisted
}
