import { afterEach, expect, it } from 'vitest'
import {
  applyAppearance,
  loadDeviceAppearance,
  saveDeviceAppearance,
} from '../src/lib/device-appearance'

afterEach(() => {
  localStorage.clear()
  document.documentElement.className = ''
  delete document.documentElement.dataset.melaTheme
})

it('loads defaults without trusting invalid saved settings', () => {
  localStorage.setItem('mela_device_preferences_v1', '{broken')
  expect(loadDeviceAppearance()).toEqual({
    theme: 'system',
    large_text: false,
    high_contrast: false,
    reduced_motion: false,
  })
})

it('applies light, contrast, motion and large text without touching account storage', () => {
  localStorage.setItem('unrelated-session', 'preserve')
  saveDeviceAppearance({ theme: 'light', high_contrast: true, large_text: true, reduced_motion: true })
  expect(document.documentElement.dataset.melaTheme).toBe('light')
  expect(document.documentElement.classList.contains('mela-high-contrast')).toBe(true)
  expect(document.documentElement.classList.contains('mela-reduced-motion')).toBe(true)
  expect(document.documentElement.classList.contains('mela-large-text')).toBe(true)
  expect(loadDeviceAppearance().theme).toBe('light')
  expect(localStorage.getItem('unrelated-session')).toBe('preserve')
  applyAppearance({ theme: 'system', high_contrast: false, large_text: false, reduced_motion: false })
  expect(document.documentElement.classList.contains('mela-high-contrast')).toBe(false)
})
