import { useEffect, useMemo, useState } from 'react'

export type ArenaDemoMode =
  | 'quiz_battle' | 'speed_quiz' | 'skill_sprint' | 'interview_practice'
  | 'case_sprint' | 'team_battle' | 'employer_challenge' | 'tournament'

type Question = { prompt: string; choices: [string,string,string,string]; correct: number; explanation: string }
const QUESTIONS: Question[] = [
  {prompt:'A study group has 12 books and receives 8 more. How many now?',choices:['18','20','21','22'],correct:1,explanation:'12 + 8 = 20.'},
  {prompt:'Which number is prime?',choices:['9','15','17','21'],correct:2,explanation:'17 has no positive divisors other than 1 and 17.'},
  {prompt:'A shop sells 5 notebooks for 6 birr each. Total price?',choices:['25 birr','28 birr','30 birr','35 birr'],correct:2,explanation:'5 × 6 = 30 birr.'},
  {prompt:'Which fraction equals 0.5?',choices:['1/4','2/5','1/2','3/4'],correct:2,explanation:'One half equals 0.5.'},
  {prompt:'A student studied 90 minutes and spent 35 on revision. Minutes left?',choices:['45','50','55','65'],correct:2,explanation:'90 − 35 = 55 minutes.'},
  {prompt:'Which value is the greatest?',choices:['0.6','0.75','0.3','0.5'],correct:1,explanation:'0.75 is the largest decimal.'},
]
const LABELS:Record<ArenaDemoMode,string>={
  quiz_battle:'Quiz Battle',speed_quiz:'Speed Quiz',skill_sprint:'Skill Sprint',
  interview_practice:'Interview Practice',case_sprint:'Case Sprint',
  team_battle:'Team Battle',employer_challenge:'Employer Challenge',tournament:'Tournament',
}
const WRITING:Partial<Record<ArenaDemoMode,{scene:string;prompt:string;rubric:string[]}>>={
  skill_sprint:{
    scene:'Staging skill drill — practical planning',
    prompt:'You have only 45 minutes to prepare a 10-minute learning activity for a group of students with different skill levels. Write three concrete steps and one way to measure their learning.',
    rubric:['Three practical steps are present','Supports learners with different needs','Contains a measurable learning check','Can be done within 45 minutes'],
  },
  interview_practice:{
    scene:'Staging interview rehearsal — not a real employer interview',
    prompt:'An interviewer asks: “Tell us about a time you solved a problem as part of a team.” Answer using the situation, your actions and the result. Use a hypothetical example if necessary.',
    rubric:['Describes the situation clearly','Explains your own specific action','Describes a measurable or realistic result','Uses respectful, professional language'],
  },
  case_sprint:{
    scene:'Staging case-study drill — no real client',
    prompt:'A rural learning centre has 30 students but only 5 computers and limited internet access. Design an affordable two-week digital skills plan that gives everyone meaningful practice.',
    rubric:['Defines the main constraint','Proposes an achievable schedule','Provides equitable access for all 30 students','Explains how progress will be checked'],
  },
  employer_challenge:{
    scene:'Sample employer-style challenge — no employer has sponsored or reviewed this',
    prompt:'A fictional Ethiopian bookshop wants more students to discover low-cost textbooks. Propose a one-week outreach campaign, including target students, message, channels, and how success is measured.',
    rubric:['Identifies a specific student audience','Uses an honest, useful message','Chooses suitable affordable channels','Includes a measurable outcome'],
  },
}
const QUIZ_MODES:ArenaDemoMode[]=['quiz_battle','speed_quiz','team_battle','tournament']
const BOT_SCORES=[1,1,2]

export function computeArenaDemoScore(answers:Record<number,number>,questions:Question[]=QUESTIONS):number {
  return questions.reduce((score,q,i)=>score+(answers[i]===q.correct?10:0),0)
}

export default function ArenaPracticeLab({mode,onBack}:{mode:ArenaDemoMode;onBack:()=>void}){
  const [answers,setAnswers]=useState<Record<number,number>>({})
  const [index,setIndex]=useState(0)
  const [done,setDone]=useState(false)
  const [seconds,setSeconds]=useState(15)
  const [response,setResponse]=useState('')
  const [responseSubmitted,setResponseSubmitted]=useState(false)
  const [checked,setChecked]=useState<Record<number,boolean>>({})
  const [role,setRole]=useState('Planner')
  const [eliminated,setEliminated]=useState(false)
  const [ackRounds,setAckRounds]=useState<number[]>([])
  const questions=QUESTIONS
  const isQuiz=QUIZ_MODES.includes(mode)
  const writing=WRITING[mode]
  const selected=answers[index]
  const correctCount=Object.entries(answers).filter(([n,a])=>questions[Number(n)]?.correct===a).length
  const completedScore=computeArenaDemoScore(answers)
  const roundIndex=Math.floor(index/2)
  const lastRound=(index+1)%2===0
  const roundOutcome=useMemo(()=>{
    if(mode!=='tournament'||index===0||index%2!==0)return null
    const previousRound=index/2-1
    const wins=[previousRound*2,previousRound*2+1].reduce((c,n)=>c+(answers[n]===questions[n].correct?1:0),0)
    return {round:previousRound+1,correct:wins,bot:BOT_SCORES[previousRound],advanced:wins>BOT_SCORES[previousRound]}
  },[answers,index,mode,questions])
  const showIntermission=mode==='tournament'&&roundOutcome&&!ackRounds.includes(roundOutcome.round)&&!done&&!eliminated

  useEffect(()=>{
    if(mode!=='speed_quiz'||done)return
    setSeconds(15)
    const timer=window.setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000)
    return ()=>window.clearInterval(timer)
  },[mode,index,done])
  useEffect(()=>{
    if(mode!=='speed_quiz'||done||seconds!==0)return
    if(index>=questions.length-1)setDone(true)
    else setIndex(x=>x+1)
  },[mode,done,seconds,index,questions.length])

  const reset=()=>{
    setAnswers({});setIndex(0);setDone(false);setSeconds(15)
    setResponse('');setResponseSubmitted(false);setChecked({})
    setEliminated(false);setAckRounds([]);setRole('Planner')
  }
  const advance=()=>{
    if(mode==='tournament'&&lastRound){
      // A two-question bracket round is acknowledged before the next one.
      const nextIndex=index+1
      setIndex(nextIndex)
      if(nextIndex>=questions.length)setDone(true)
    }else if(index>=questions.length-1)setDone(true)
    else setIndex(index+1)
  }
  const answer=selected===undefined?null:questions[index]?.correct===selected
  const total=mode==='team_battle'?4:questions.length
  const activeQuestions=mode==='team_battle'?questions.slice(0,4):questions
  const localScore=computeArenaDemoScore(answers,activeQuestions)
  const practiceOutcome=done||eliminated

  return <div className="dash-main" aria-label={LABELS[mode]+' practice demonstration'}>
    <div className="section-heading">
      <h1>{LABELS[mode]} · Interactive demo</h1>
      <button className="btn btn-secondary" onClick={onBack}>Back to all 8 modes</button>
    </div>
    <section className="banner banner-info" role="status">
      <strong>STAGING ONLY · Practice simulation, NOT an official match</strong>
      <p>No real opponents, judges, employers, prizes, ranking or verified progress are involved. Answers and scores stay on this screen and disappear when you leave or refresh.</p>
    </section>
    {isQuiz&&mode==='team_battle'&&<div className="field">
      <label htmlFor="demo-team-role">Your practice team role (no real teammates connected)</label>
      <select id="demo-team-role" value={role} onChange={e=>setRole(e.target.value)}>
        <option>Planner</option><option>Researcher</option><option>Presenter</option>
      </select>
      <p className="muted">This exercise compares your answers with a clearly simulated opponent team.</p>
    </div>}
    {isQuiz&&!practiceOutcome&&!showIntermission&&<section className="list-panel">
      <h2>{mode==='tournament'? 'Practice bracket round '+(roundIndex+1)+' of 3':mode==='team_battle'?'Team drill':'Question'} · {Math.min(index+1,total)} / {total}</h2>
      {mode==='speed_quiz'&&<p role="timer"><strong>Seconds left: {seconds}</strong> · unanswered questions get zero points.</p>}
      <p>{questions[index].prompt}</p>
      {questions[index].choices.map((choice,i)=><button key={i} type="button"
        className="list-row" style={{display:'block',width:'100%',textAlign:'left',background:selected===i?'var(--gold-soft)':'transparent'}}
        disabled={selected!==undefined} onClick={()=>setAnswers(old=>({...old,[index]:i}))}>
          {String.fromCharCode(65+i)}. {choice}
        </button>)}
      {selected!==undefined&&<>
        <p role="status"><strong>{answer?'Correct':'Not correct'}.</strong> {questions[index].explanation}</p>
        <button className="btn btn-primary" onClick={advance}>
          {index>=total-1?'View practice result':lastRound&&mode==='tournament'?'See bracket result':'Next question'}
        </button>
      </>}
      {mode==='speed_quiz'&&selected===undefined&&<button className="btn btn-secondary" onClick={advance}>Skip</button>}
    </section>}
    {showIntermission&&roundOutcome&&<section className="list-panel">
      <h2>Simulated bracket — Round {roundOutcome.round}</h2>
      <p>Your answers: {roundOutcome.correct} correct. Practice bot: {roundOutcome.bot} correct.</p>
      <p><strong>{roundOutcome.advanced?'You advance in this demo bracket.':roundOutcome.correct===roundOutcome.bot?'Practice draw — no advancement.':'Demo elimination — bot advances.'}</strong></p>
      {roundOutcome.advanced&&<button className="btn btn-primary" onClick={()=>{
        setAckRounds(prev=>[...prev,roundOutcome.round])
        if(index>=questions.length)setDone(true)
      }}>Continue practice bracket</button>}
      {!roundOutcome.advanced&&<button className="btn btn-primary" onClick={()=>setEliminated(true)}>View practice result</button>}
    </section>}
    {practiceOutcome&&isQuiz&&<section className="list-panel" role="status">
      <h2>Practice completed</h2>
      <p><strong>{localScore} points</strong> · {correctCount} correct of {total} questions attempted.</p>
      {mode==='team_battle'&&<p>Practice bot team: 20 points. {localScore>20?'Your practice team wins.':localScore===20?'Practice team draw.':'Practice bot team wins.'} Neither side represents real learners.</p>}
      {mode==='tournament'&&<p>{eliminated?'The local bracket ended with a practice elimination.':'You completed the local bracket.'} The opposing teams were scripted practice bots, not real players.</p>}
      <button className="btn btn-primary" onClick={reset}>Practice again</button>
    </section>}
    {writing&&<section className="list-panel">
      <h2>{writing.scene}</h2>
      <p>{writing.prompt}</p>
      <label htmlFor="arena-practice-written">Your response</label>
      <textarea id="arena-practice-written" rows={6} style={{width:'100%',maxWidth:'100%'}}
        value={response} disabled={responseSubmitted} onChange={e=>setResponse(e.target.value)}/>
      {!responseSubmitted?<button className="btn btn-primary"
        disabled={response.trim().length<40} onClick={()=>setResponseSubmitted(true)}>
        Submit practice response
      </button>:<div role="status">
        <h3>Review your answer using this checklist</h3>
        <p>These are reflection checks, not verified grades. No AI or human judge reviewed this answer.</p>
        {writing.rubric.map((item,i)=><label key={i} style={{display:'block',margin:'8px 0'}}>
          <input type="checkbox" checked={Boolean(checked[i])} onChange={e=>setChecked(old=>({...old,[i]:e.target.checked}))}/> {item}
        </label>)}
        <p>{Object.values(checked).filter(Boolean).length} of {writing.rubric.length} self-review criteria checked. Not a competition score.</p>
        <button className="btn btn-primary" onClick={reset}>Try this skill again</button>
      </div>}
      {!responseSubmitted&&<p className="muted">Write at least 40 characters to practice submitting. No text is sent to the Arena server.</p>}
    </section>}
  </div>
}
