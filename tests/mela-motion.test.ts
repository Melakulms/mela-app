// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const motion = readFileSync(new URL('../src/mela-motion.css', import.meta.url), 'utf8')
const entry = readFileSync(new URL('../src/main.tsx', import.meta.url), 'utf8')

it('loads a shared motion layer for the whole learner app, not registration alone', () => {
  expect(entry).toContain("import './mela-motion.css'")
  expect(motion).toContain('#main-content > *')
  expect(motion).toContain('.auth-shell .auth-card')
  expect(motion).toContain('.module-grid > .module-card')
  expect(motion).toContain('.dash-main > .list-panel')
  expect(motion).toContain('.settings-center')
  expect(motion).toContain('.profile-access-intro')
  expect(motion).toContain('border-top: 3px solid var(--gold)')
  expect(motion).toContain('.app-topbar::before')
  expect(motion).toContain('.bottom-nav button.active')
  expect(motion).toContain('.mela-motion-preview .mela-preview-mark')
})

it('keeps animation bounded and safe for old Android devices', () => {
  expect(motion).toContain('prefers-reduced-motion: no-preference')
  expect(motion).toContain(':not(.mela-reduced-motion):not(.mela-low-data)')
  expect(motion).toContain('html.mela-reduced-motion *')
  expect(motion).toContain('animation: none !important')
  expect(motion).toContain('animation: mela-star-twinkle 6s ease-in-out infinite')
  expect((motion.match(/animation: [^;]*infinite/g) ?? []).length).toBe(1)
  expect(motion).toContain('html.mela-low-data *')
  expect(motion).not.toContain('background-attachment: fixed')
  expect(motion).not.toContain('will-change:')
})

it('preserves disabled cards and limits staggering to the first six dashboard tiles', () => {
  expect(motion).toContain('.module-card:nth-child(-n+6)')
  expect(motion).toContain('@media (hover: hover) and (pointer: fine)')
  expect(motion).toContain(':not(:disabled):active')
  const tileRules = motion.match(/@keyframes mela-tile-enter \{([^}]*\}[^}]*)\}/)
  expect(tileRules?.[1]).not.toContain('opacity')
})
