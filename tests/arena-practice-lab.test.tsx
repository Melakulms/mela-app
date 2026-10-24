// @vitest-environment jsdom
import { afterEach,beforeEach,describe,expect,it,vi } from 'vitest'
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react'
import ArenaPracticeLab, {computeArenaDemoScore,type ArenaDemoMode} from '../src/components/ArenaPracticeLab'
import {loadArenaPracticeAnswer,saveArenaPracticeAnswer} from '../src/lib/arena-practice-submissions'

vi.mock('../src/lib/arena-practice-submissions',()=>({
  loadArenaPracticeAnswer:vi.fn(),
  saveArenaPracticeAnswer:vi.fn(),
}))

beforeEach(()=>{
  vi.mocked(loadArenaPracticeAnswer).mockResolvedValue(null)
  vi.mocked(saveArenaPracticeAnswer).mockImplementation(async(_,response)=>({
    id:'01111111-2222-4333-8444-555555555555',
    response_text:response.trim(),
    saved_at:'2026-10-25T10:00:00Z',
  }))
})
afterEach(()=>{
  cleanup()
  vi.resetAllMocks()
})

const modes:ArenaDemoMode[]=[
  'quiz_battle','speed_quiz','skill_sprint','interview_practice',
  'case_sprint','team_battle','employer_challenge','tournament',
]
describe('MELA Arena all eight staging practice modes',()=>{
  for(const mode of modes){
    it(mode+' has a distinct activity, without claiming official outcomes',()=>{
      render(<ArenaPracticeLab mode={mode} onBack={()=>{}}/>)
      expect(screen.getByText(/Practice simulation, NOT an official match/i)).toBeTruthy()
      expect(screen.getByRole('button',{name:/Back to all 8 modes/i})).toBeTruthy()
      if(['skill_sprint','interview_practice','case_sprint','employer_challenge'].includes(mode)){
        expect(screen.getByRole('textbox',{name:/Your response/i})).toBeTruthy()
        expect(screen.getByRole('button',{name:/Submit practice answer/i})).toBeTruthy()
      }else{
        expect(screen.getByText(/A study group has 12 books/i)).toBeTruthy()
      }
    })
  }
  it('grades practice quizzes entirely locally without official points',()=>{
    expect(computeArenaDemoScore({0:1,1:2,2:2,3:2,4:2,5:1})).toBe(60)
    expect(computeArenaDemoScore({0:0,1:0})).toBe(0)
  })
  it('employer challenge accepts even short answers and confirms private server receipt',async()=>{
    render(<ArenaPracticeLab mode="employer_challenge" onBack={()=>{}}/>)
    const send=screen.getByRole('button',{name:/Submit practice answer/i}) as HTMLButtonElement
    await waitFor(()=>expect(send.disabled).toBe(false))
    fireEvent.click(send)
    expect(await screen.findByRole('alert')).toHaveProperty('textContent','Write an answer before tapping Submit.')
    fireEvent.change(screen.getByRole('textbox',{name:/Your response/i}),{
      target:{value:'Use posters.'}
    })
    fireEvent.click(send)
    expect(await screen.findByText(/Practice answer submitted and saved to your private staging account/i)).toBeTruthy()
    expect(vi.mocked(saveArenaPracticeAnswer)).toHaveBeenCalledWith('employer_challenge','Use posters.')
    expect(screen.getByText(/NOT sent to an employer/i)).toBeTruthy()
    expect(screen.getByText(/No AI or human judge reviewed this answer/i)).toBeTruthy()
  })
  it('keeps text available after failed network save and supports retry',async()=>{
    vi.mocked(saveArenaPracticeAnswer).mockRejectedValueOnce(new Error('Network unavailable'))
    render(<ArenaPracticeLab mode="employer_challenge" onBack={()=>{}}/>)
    const send=screen.getByRole('button',{name:/Submit practice answer/i}) as HTMLButtonElement
    await waitFor(()=>expect(send.disabled).toBe(false))
    fireEvent.change(screen.getByRole('textbox',{name:/Your response/i}),{
      target:{value:'I propose a one-week outreach plan.'},
    })
    fireEvent.click(send)
    expect(await screen.findByText('Network unavailable')).toBeTruthy()
    expect((screen.getByRole('textbox',{name:/Your response/i}) as HTMLTextAreaElement).value)
      .toBe('I propose a one-week outreach plan.')
    fireEvent.click(send)
    expect(await screen.findByText(/Practice answer submitted and saved to your private staging account/i)).toBeTruthy()
  })
  it('restores previously saved private practice answers on return',async()=>{
    vi.mocked(loadArenaPracticeAnswer).mockResolvedValueOnce({
      id:'01111111-2222-4333-8444-555555555555',
      response_text:'My previously submitted outreach idea.',
      saved_at:'2026-10-25T10:00:00Z',
    })
    render(<ArenaPracticeLab mode="employer_challenge" onBack={()=>{}}/>)
    expect(await screen.findByText(/Practice answer submitted and saved to your private staging account/i)).toBeTruthy()
    expect((screen.getByRole('textbox',{name:/Your response/i}) as HTMLTextAreaElement).value)
      .toBe('My previously submitted outreach idea.')
  })
  it('clearly labels simulated tournament opponents',()=>{
    render(<ArenaPracticeLab mode="tournament" onBack={()=>{}}/>)
    expect(screen.getByText(/no real opponents, judges, employers, prizes/i)).toBeTruthy()
    expect(screen.getByText(/Practice bracket round 1 of 3/i)).toBeTruthy()
  })
})
