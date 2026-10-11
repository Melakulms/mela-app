import { useState } from 'react'
import curriculum from '../lib/ai-year-one-draft.json'

export default function DraftCourseReader({onBack}: {onBack: () => void}) {
  const [index, setIndex] = useState(0)
  const lesson = curriculum.lessons[index]
  return <div className="dash-main">
    <button className="btn btn-secondary" onClick={onBack}>Back to courses</button>
    <h1>AI Education — Year One</h1>
    <p role="status">Teacher-review draft · English · Week {lesson.week} of 52</p>
    <p>For secondary-age and adult beginners. Teacher approval is pending. Reading does not record course completion or issue a certificate.</p>
    <label htmlFor="draft-week">Choose a week</label>
    <select id="draft-week" value={index} onChange={e => setIndex(Number(e.target.value))}>{curriculum.lessons.map((item, i) => <option key={item.id} value={i}>Week {item.week}: {item.title}</option>)}</select>
    <article className="list-panel" key={lesson.id}>
      <h2>{lesson.title}</h2><p>{lesson.module_title}</p>
      <h3>Learning goals</h3><ul>{lesson.objectives.map(goal => <li key={goal}>{goal}</li>)}</ul>
      <p>{lesson.lesson_text}</p>
      <h3>Worked example</h3><p>{lesson.worked_example}</p>
      <h3>Practical activity</h3><p>{lesson.practical_task}</p>
      <h3>Check your understanding</h3><p>{lesson.assessment_questions}</p>
      <h3>Suggested sessions</h3><ol>{lesson.sessions.map((session, i) => <li key={i}>{session.activity} ({session.minutes} guided minutes)</li>)}</ol>
      <h3>Evidence for your teacher</h3><p>{lesson.evidence_required}</p>
    </article>
    <div className="toolbar"><button className="btn btn-secondary" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Previous week</button><button className="btn btn-primary" disabled={index === curriculum.lessons.length - 1} onClick={() => setIndex(i => i + 1)}>Next week</button></div>
    <a href={`${import.meta.env.BASE_URL}ai-year-one.html`} download="MELA-AI-Year-One.html">Download all 52 weeks</a>
  </div>
}
