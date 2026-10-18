import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import SkillAcademy from '../src/pages/SkillAcademy'
vi.mock('../src/i18n', () => ({useI18n: () => ({t: (key: string) => key})}))
vi.mock('../src/lib/academy', () => ({fetchCourses: async () => {throw new Error('Catalogue unavailable')}, fetchMyEnrollments: async () => [], enrollInCourse: vi.fn()}))
afterEach(cleanup)
it('keeps draft lessons accessible when the database catalogue fails', async () => {
  render(<SkillAcademy onBack={() => {}} />)
  await screen.findByRole('alert')
  expect(screen.getByRole('link', {name: 'Open AI Year One — draft preview'}).getAttribute('href')).toMatch(/ai-year-one\.html$/)
  expect(screen.getByText(/teacher approval and translations are pending/)).toBeTruthy()
})
it('ships all 52 navigable weeks without exposing teacher answer keys', () => {
  const html = readFileSync('public/ai-year-one.html', 'utf8')
  expect((html.match(/id="week-\d+"/g) ?? []).length).toBe(52)
  expect((html.match(/href="#week-\d+"/g) ?? []).length).toBe(52)
  expect(html).not.toContain('teacher_answer_guide')
  // One same-origin, reviewed helper is allowed for public reading bookmarks.
  // No inline scripts or extra external scripts are allowed in lesson content.
  expect(html.match(/<script[^>]*>/g)).toEqual(['<script defer src="offline-progress.js">'])
  const helper = readFileSync('public/offline-progress.js', 'utf8')
  expect(helper).toContain('mela-public-ai-last-unit-v1')
  expect(helper).not.toContain('supabase')
  expect(helper).not.toContain('access_token')
})
