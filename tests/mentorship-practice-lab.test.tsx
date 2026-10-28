import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MentorshipPracticeLab, { PRACTICE_EXERCISES } from '../src/components/MentorshipPracticeLab'

afterEach(cleanup)

describe('Mentorship practice tools', () => {
  it('has distinct exercises for each of the 16 subsections', () => {
    expect(Object.keys(PRACTICE_EXERCISES).map(Number).sort((a,b)=>a-b)).toEqual(
      Array.from({ length: 16 }, (_, index) => index + 1)
    )
    for (const [index, exercise] of Object.entries(PRACTICE_EXERCISES)) {
      expect(exercise.title.length).toBeGreaterThan(10)
      expect(exercise.checks).toHaveLength(3)
      expect(index).toMatch(/^\d+$/)
    }
  })

  it('creates a clearly labeled local worksheet, updates checklist and clears it', () => {
    render(<MentorshipPracticeLab section={6}/>)
    expect(screen.getByText(/Interactive practice only/)).toBeTruthy()
    const create = screen.getByRole('button', {name:'Generate practice worksheet'})
    expect((create as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Request topic'), {target:{value:'Scholarship essay'}})
    fireEvent.change(screen.getByLabelText('Specific help I will ask for'), {target:{value:'Review the structure'}})
    fireEvent.click(screen.getByLabelText('My request is polite and clear'))
    expect(screen.getByText('My preparation checklist (1/3)')).toBeTruthy()
    fireEvent.click(create)
    const worksheet = screen.getByRole('textbox', {name:'Worksheet text for copying'}) as HTMLTextAreaElement
    expect(worksheet.value).toContain('PRACTICE ONLY')
    expect(worksheet.value).toContain('Scholarship essay')
    expect(worksheet.value).toContain('[x] My request is polite and clear')
    fireEvent.click(screen.getByRole('button',{name:'Clear worksheet'}))
    expect(screen.queryByRole('textbox',{name:'Worksheet text for copying'})).toBeNull()
    expect((screen.getByLabelText('Request topic') as HTMLInputElement).value).toBe('')
    expect(screen.getByText('My preparation checklist (0/3)')).toBeTruthy()
  })

  it('rejects a past practice booking without sending a real reservation', () => {
    render(<MentorshipPracticeLab section={7}/>)
    fireEvent.change(screen.getByLabelText('Session topic'), {target:{value:'Career planning'}})
    fireEvent.change(screen.getByLabelText('What I will prepare beforehand'), {target:{value:'Questions to discuss'}})
    fireEvent.change(screen.getByLabelText(/Preferred date and time/), {target:{value:'2020-01-01T09:00'}})
    fireEvent.click(screen.getByRole('button',{name:'Generate practice worksheet'}))
    expect(screen.getByRole('alert').textContent).toMatch(/future preferred date and time/)
    expect(screen.queryByRole('textbox',{name:'Worksheet text for copying'})).toBeNull()
  })

  it('does not expose a false live call or admin approval action', () => {
    const { rerender } = render(<MentorshipPracticeLab section={8}/>)
    expect(screen.getByText(/live video\/audio remains unavailable/)).toBeTruthy()
    expect(screen.queryByRole('button', {name:/start call/i})).toBeNull()
    rerender(<MentorshipPracticeLab key={16} section={16}/>)
    expect(screen.getByText(/No administrative approval or MFA action/)).toBeTruthy()
    expect(screen.queryByRole('button', {name:/approve mentor/i})).toBeNull()
  })
})
