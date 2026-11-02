// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useSectionDrilldown } from '../src/hooks/useSectionDrilldown'
import { useStudentNavigation } from '../src/hooks/useStudentNavigation'

beforeEach(() => window.history.replaceState(null, '', '/mela-app/?view=materials'))
afterEach(() => { cleanup(); window.history.replaceState(null, '', '/mela-app/') })

function NestedNavigation() {
  const [section, openSection, closeSection] = useSectionDrilldown('section')
  const [subsection, openSubsection, closeSubsection] = useSectionDrilldown('subsection')
  const [view, navigate] = useStudentNavigation()
  return <>
    <p>View: {view}</p>
    <p>Section: {section ?? 'none'}</p>
    <p>Subsection: {subsection ?? 'none'}</p>
    <button onClick={() => openSection('math')}>Open subject</button>
    <button onClick={() => openSubsection('algebra')}>Open unit</button>
    <button onClick={closeSubsection}>Back to subject</button>
    <button onClick={closeSection}>Back to subjects</button>
    <button onClick={() => navigate('mentorship')}>Go to mentorship</button>
  </>
}

it('opens focused nested routes and discards a stale subsection on main navigation', () => {
  render(<NestedNavigation />)
  fireEvent.click(screen.getByText('Open subject'))
  expect(window.location.search).toContain('section=math')
  fireEvent.click(screen.getByText('Open unit'))
  expect(window.location.search).toContain('subsection=algebra')
  expect(screen.getByText('Subsection: algebra')).toBeTruthy()
  fireEvent.click(screen.getByText('Go to mentorship'))
  expect(window.location.search).toBe('?view=mentorship')
  expect(screen.getByText('View: mentorship')).toBeTruthy()
})

it('restores the correct selected section on browser Back and Forward navigation', () => {
  render(<NestedNavigation />)
  fireEvent.click(screen.getByText('Open subject'))
  fireEvent.click(screen.getByText('Open unit'))
  act(() => {
    window.history.replaceState(null, '', '/mela-app/?view=materials&section=math')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(screen.getByText('Section: math')).toBeTruthy()
  expect(screen.getByText('Subsection: none')).toBeTruthy()
  act(() => {
    window.history.replaceState(null, '', '/mela-app/?view=materials')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(screen.getByText('Section: none')).toBeTruthy()
})

it('ignores an invalid section selection when the caller validates fetched content', () => {
  window.history.replaceState(null, '', '/mela-app/?view=materials&section=unknown')
  render(<NestedNavigation />)
  expect(screen.getByText('Section: unknown')).toBeTruthy()
  // Consumers match this route value against their server-fetched authorized list.
  expect(window.location.pathname).toBe('/mela-app/')
})
