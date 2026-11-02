import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

// Guard the real mobile interface rather than a separate mockup.
it('styles inner feature pages with readable type and distinctive subsection cards', () => {
  const css = readFileSync('src/mela-professional.css', 'utf8')
  expect(css).toContain('/* Mobile readability and professional subsection surfaces')
  expect(css).toContain('.mela-professional .dash-main:not(.dashboard-main)')
  expect(css).toContain('font-size: 1.0625rem;')
  expect(css).toContain('.mela-professional .mela-subsection-card')
  expect(css).toContain('.mela-subsection-card:nth-child(8n+8)')
  expect(css).toContain('.mela-subsection-grid { grid-template-columns: 1fr;')
  expect(css).toContain('prefers-reduced-motion:no-preference')
  expect(css).toContain('html[data-mela-theme="dark"] .mela-professional .mela-subsection-card')
})

it('keeps inner-section links interactive and the focused mentorship practice view honest', () => {
  const mentor = readFileSync('src/components/MentorshipPreparationStudio.tsx', 'utf8')
  const earn = readFileSync('src/pages/EarnWork.tsx', 'utf8')
  expect(mentor).toContain('aria-label={`Open practice: ${card.title}`}')
  expect(mentor).toContain('onClick={() => openSection(String(number))}')
  expect(mentor).toContain('className="mela-section-focus"')
  expect(mentor).toContain('Practice only — this exercise is not a real mentor request')
  expect(earn).toContain('className="mela-work-menu"')
  expect(earn).toContain('aria-pressed={section===\'browse\'}')
  expect(earn).toContain('onClick={() => changeSection(\'contracts\')}')
  expect(earn).toContain('onClick={() => changeSection(\'rewards\')}')
})
