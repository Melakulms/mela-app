export type ThemeMode = 'system' | 'dark' | 'light'
type Appearance = { theme: ThemeMode; large_text: boolean; high_contrast: boolean; reduced_motion: boolean }

export function applyAppearance(settings: Appearance) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.melaTheme = settings.theme
  root.classList.toggle('mela-large-text', settings.large_text)
  root.classList.toggle('mela-high-contrast', settings.high_contrast)
  root.classList.toggle('mela-reduced-motion', settings.reduced_motion)
}

export function loadDeviceAppearance(): Appearance {
  try {
    const value = JSON.parse(localStorage.getItem('mela_device_preferences_v1') || '{}')
    const theme: ThemeMode = value.theme === 'light' || value.theme === 'dark' ? value.theme : 'system'
    return {
      theme,
      large_text: value.largeText === true,
      high_contrast: value.highContrast === true,
      reduced_motion: value.reducedMotion === true,
    }
  } catch {
    return { theme: 'system', large_text: false, reduced_motion: false, high_contrast: false }
  }
}

export function saveDeviceAppearance(settings: Appearance) {
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
