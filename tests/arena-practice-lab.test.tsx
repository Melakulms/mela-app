// @vitest-environment jsdom
import { afterEach,describe,expect,it } from 'vitest'
import { cleanup,fireEvent,render,screen } from '@testing-library/react'
import ArenaPracticeLab, {computeArenaDemoScore,type ArenaDemoMode} from '../src/components/ArenaPracticeLab'

afterEach(()=>cleanup())

const modes:ArenaDemoMode[]=[
  'quiz_battle','speed_quiz','skill_sprint','interview_practice',
  'case_sprint','team_battle','employer_challenge','tournament',
]
describe('MELA staging Arena eight-mode practice coverage',()=>{
  for(const mode of modes){
    it(mode+' renders a distinct interactive practice exercise with no official results',()=>{
      render(<ArenaPracticeLab mode={mode} onBack={()=>{}}/>)
      expect(screen.getByText(/Practice simulation, NOT an official match/i)).toBeTruthy()
      expect(screen.getByRole('button',{name:/Back to all 8 modes/i})).toBeTruthy()
      if(['skill_sprint','interview_practice','case_sprint','employer_challenge'].includes(mode)){
        expect(screen.getByRole('textbox',{name:/Your response/i})).toBeTruthy()
        expect(screen.getByRole('button',{name:/Submit practice response/i})).toBeTruthy()
      }else{
        expect(screen.getByText(/A study group has 12 books/i)).toBeTruthy()
      }
    })
  }
  it('computes correct scores without storing accounts or points',()=>{
    expect(computeArenaDemoScore({0:1,1:2,2:2,3:2,4:2,5:1})).toBe(60)
    expect(computeArenaDemoScore({0:0,1:0})).toBe(0)
  })
  it('requires meaningful written work and keeps review self-reported',()=>{
    render(<ArenaPracticeLab mode="employer_challenge" onBack={()=>{}}/>)
    const send=screen.getByRole('button',{name:/Submit practice response/i}) as HTMLButtonElement
    expect(send.disabled).toBe(true)
    fireEvent.change(screen.getByRole('textbox',{name:/Your response/i}),{
      target:{value:'I would ask the bookshop for permission, design a clear student notice, share it at schools, and count inquiries.'},
    })
    expect(send.disabled).toBe(false)
    fireEvent.click(send)
    expect(screen.getByText(/No AI or human judge reviewed this answer/i)).toBeTruthy()
    expect(screen.getByText(/Not a competition score/i)).toBeTruthy()
  })
  it('makes tournament opponents explicitly simulated rather than real people',()=>{
    render(<ArenaPracticeLab mode="tournament" onBack={()=>{}}/>)
    expect(screen.getByText(/no real opponents, judges, employers, prizes/ii)).toBeTruthy()
    expect(screen.getByText(/Practice bracket round 1 of 3/i)).toBeTruthy()
  })
})
