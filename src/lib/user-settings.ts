import { supabase } from './supabase'

export type ThemeMode = 'system' | 'dark' | 'light'
export type UserSettings = {
  theme: ThemeMode
  large_text: boolean
  high_contrast: boolean
  reduced_motion: boolean
  notify_courses: boolean
  notify_competitions: boolean
  notify_opportunities: boolean
  notify_messages: boolean
  study_reminders: boolean
  daily_study_minutes: number
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'system',
  large_text: false,
  high_contrast: false,
  reduced_motion: false,
  notify_courses: true,
  notify_competitions: true,
  notify_opportunities: true,
  notify_messages: true,
  study_reminders: false,
  daily_study_minutes: 20,
}

export function applyAppearance(settings: Pick<UserSettings, 'theme' | 'large_text' | 'high_contrast' | 'reduced_motion'>) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.melaTheme = settings.theme
  root.classList.toggle('mela-large-text', settings.large_text)
  root.classList.toggle('mela-high-contrast', settings.high_contrast)
  root.classList.toggle('mela-reduced-motion', settings.reduced_motion)
}

export function loadDeviceAppearance() {
  try {
    const value = JSON.parse(localStorage.getItem('mela_device_preferences_v1') || '{}')
    const theme = value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system'
    return {
      theme: theme as ThemeMode,
      large_text: value.largeText === true,
      reduced_motion: value.reducedMotion === true,
      high_contrast: value.highContrast === true,
    }
  } catch {
    return { theme: 'system' as ThemeMode, large_text: false, reduced_motion: false, high_contrast: false }
  }
}

export function saveDeviceAppearance(settings: Pick<UserSettings, 'theme' | 'large_text' | 'high_contrast' | 'reduced_motion'>) {
  applyAppearance(settings)
  try {
    localStorage.setItem('mela_device_preferences_v1', JSON.stringify({
      theme: settings.theme,
      largeText: settings.large_text,
      highContrast: settings.high_contrast,
      reducedMotion: settings.reduced_motion,
    }))
    window.dispatchEvent(new Event('mela-settings-changed'))
  } catch { /* Appearance still applies during this session. */ }
}

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Sign in to manage account preferences.')
  return data.user.id
}

export async function fetchUserSettings(): Promise<UserSettings> {
  const userId = await currentUserId()
  const { data, error } = await supabase.from('mela_user_settings')
    .select('theme,large_text,high_contrast,reduced_motion,notify_courses,notify_competitions,notify_opportunities,notify_messages,study_reminders,daily_study_minutes')
    .eq('user_id', userId).maybeSingle()
  if (error) throw error
  return { ...DEFAULT_USER_SETTINGS, ...(data ?? {}) }
}

export async function updateUserSettings(settings: UserSettings): Promise<void> {
  const userId = await currentUserId()
  if (!['light','dark','system'].includes(settings.theme)
    || !Number.isInteger(settings.daily_study_minutes)
    || settings.daily_study_minutes < 5 || settings.daily_study_minutes > 240) {
    throw new Error('Invalid settings. Check the theme and study goal.')
  }
  const { error } = await supabase.from('mela_user_settings')
    .upsert({ user_id: userId, ...settings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
}
