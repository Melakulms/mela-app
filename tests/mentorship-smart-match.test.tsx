import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import MentorshipSmartMatch from '../src/components/MentorshipSmartMatch'
import type { Mentor } from '../src/lib/mentorship'

afterEach(cleanup)
const mentor = (id:string, name:string, expertise:string[], languages:string[]):Mentor => ({
  user_id:id,full_name:name,headline:expertise.join(' '),bio:null,organization:null,
  years_experience:4,rating_average:0,rating_count:0,expertise,languages,availability:[],
})

const mentors = [
  mentor('mentor-a','Verified Programmer',['Software programming','AI'],['Amharic']),
  mentor('mentor-b','Verified Marketer',['Marketing','Sales'],['English']),
]

it('shows only relevant verified profile matches and uses real listed languages', () => {
  const browse=vi.fn()
  render(<MentorshipSmartMatch mentors={mentors} requests={[]} requestsAvailable stageKey="university" onBrowse={browse}/>)
  const input=screen.getByRole('textbox',{name:'My learning or career goal'})
  fireEvent.change(input,{target:{value:'programming'}})
  fireEvent.click(screen.getByRole('button',{name:'Find matching mentors'}))
  expect(screen.getByText('Verified Programmer')).toBeTruthy()
  expect(screen.queryByText('Verified Marketer')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Open verified mentor directory'}))
  expect(browse).toHaveBeenCalledOnce()
  expect(screen.getByText(/not saved to your MELA profile/)).toBeTruthy()
})

it('never bypasses age restrictions or incomplete private request history', () => {
  const {rerender}=render(<MentorshipSmartMatch mentors={mentors} requests={[]} requestsAvailable
    stageKey="school_9_10" onBrowse={vi.fn()} />)
  expect(screen.queryByRole('button',{name:'Find matching mentors'})).toBeNull()
  rerender(<MentorshipSmartMatch mentors={mentors} requests={[]} requestsAvailable={false}
    stageKey="university" onBrowse={vi.fn()} />)
  expect(screen.getByText(/Matching is paused to avoid recommending a mentor/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Find matching mentors'})).toBeNull()
})

it('excludes mentors already contacted through genuine pending requests', () => {
  render(<MentorshipSmartMatch mentors={mentors} requests={[{
    id:'request-1',mentor_id:'mentor-a',topic:'Programming',
    status:'pending',created_at:'2026-10-20',
  }]} requestsAvailable stageKey="university" onBrowse={vi.fn()} />)
  fireEvent.change(screen.getByRole('textbox',{name:'My learning or career goal'}),
    {target:{value:'programming'}})
  fireEvent.click(screen.getByRole('button',{name:'Find matching mentors'}))
  expect(screen.queryByText('Verified Programmer')).toBeNull()
  expect(screen.getByText(/No verified mentor profile matches this goal/)).toBeTruthy()
})
