import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MentorshipMentorCompare from '../src/components/MentorshipMentorCompare'
import type { Mentor } from '../src/lib/mentorship'

afterEach(cleanup)

const mentor = (id:string, fullName:string, extras:Partial<Mentor> = {}):Mentor => ({
  user_id:id, full_name:fullName, headline:'Professional guidance', bio:null, organization:null,
  years_experience:null, rating_average:0, rating_count:0, expertise:[],languages:[],availability:[],...extras
})

it('compares only the real published fields of known verified profiles', () => {
  const remove=vi.fn(), clear=vi.fn()
  render(<MentorshipMentorCompare mentors={[
    mentor('a','Mentor A',{expertise:['Programming'],languages:['Amharic'],rating_average:4.5,rating_count:8}),
    mentor('b','Mentor B'),
  ]} selectedIds={['a','b','nonexistent']} onToggle={remove} onClear={clear} />)
  expect(screen.getByText('2 of 3 profiles selected for comparison.')).toBeTruthy()
  expect(screen.getByRole('table')).toBeTruthy()
  expect(screen.getByText('Programming')).toBeTruthy()
  expect(screen.getByText('Not yet rated')).toBeTruthy()
  expect(screen.queryByText('nonexistent')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Remove Mentor A'}))
  expect(remove).toHaveBeenCalledWith('a')
  fireEvent.click(screen.getByRole('button',{name:'Clear comparison'}))
  expect(clear).toHaveBeenCalledOnce()
})

it('explains an empty comparison without inventing any mentor identities',()=>{
  render(<MentorshipMentorCompare mentors={[]} selectedIds={[]} onToggle={vi.fn()} onClear={vi.fn()}/>)
  expect(screen.getByText(/No profiles selected/)).toBeTruthy()
  expect(screen.queryByRole('table')).toBeNull()
})
