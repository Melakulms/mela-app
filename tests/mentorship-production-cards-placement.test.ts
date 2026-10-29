import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

it('renders the 16 mentorship cards before resources and backend loading gates', () => {
  const page = readFileSync('src/pages/Mentorship.tsx', 'utf8')
  const initialNav = page.indexOf('<MentorshipPreparationStudio />')
  const guides = page.indexOf('<MentorshipGuidanceResources />')
  const asyncLoading = page.indexOf('{loading &&')
  expect(initialNav).toBeGreaterThan(-1)
  expect(initialNav).toBeLessThan(guides)
  expect(initialNav).toBeLessThan(asyncLoading)
  expect(page.match(/<MentorshipPreparationStudio \/>/g)).toHaveLength(1)
})
