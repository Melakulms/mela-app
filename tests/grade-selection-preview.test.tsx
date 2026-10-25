import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import GradeSelectionPreview from '../src/components/GradeSelectionPreview'

afterEach(cleanup)

describe('Read-only grade preview for mobile registration and profile testing', () => {
  it('offers every Grade 1–12 with no grade preselected', () => {
    render(<GradeSelectionPreview />)
    fireEvent.click(screen.getByText(/Demo only: Preview Grades 1–12/))
    const select = screen.getByLabelText('Preview school grade (1–12)') as HTMLSelectElement
    expect(select.value).toBe('')
    expect(Array.from(select.options).map(option => option.value)).toEqual([
      '', ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
    ])
    expect(screen.getByText(/does not save a grade/)).toBeTruthy()
  })

  it('maps every grade to the right band and never writes to user profiles', () => {
    render(<GradeSelectionPreview />)
    fireEvent.click(screen.getByText(/Demo only: Preview Grades 1–12/))
    const select = screen.getByLabelText('Preview school grade (1–12)') as HTMLSelectElement
    for (const grade of Array.from({ length: 12 }, (_, i) => i + 1)) {
      fireEvent.change(select, { target: { value: String(grade) } })
      expect(select.value).toBe(String(grade))
      const label = grade <= 6 ? 'Primary school' : grade <= 8 ? 'Upper primary school'
        : grade <= 10 ? 'Secondary school' : 'Senior secondary school'
      expect(screen.getByRole('status').textContent).toContain('Grade ' + grade)
      expect(screen.getByRole('status').textContent).toContain(label)
    }
  })
})
