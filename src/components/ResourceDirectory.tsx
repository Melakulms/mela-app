import { useState } from 'react'
import { safeExternalUrl } from '../lib/external-url'

// Official-source starter list. This is not the missing historical 2,000-site dataset.
export const RESOURCES = [
  { name: 'MIT OpenCourseWare', category: 'Education', region: 'Global', url: 'https://ocw.mit.edu/pages/get-started/', note: 'University course materials; self-study does not grant MIT admission or credit.' },
  { name: 'OpenLearn', category: 'Education', region: 'Global', url: 'https://www.open.edu/openlearn/free-courses/full-catalogue', note: 'Open University learning catalogue. Check each course’s requirements.' },
  { name: 'IBM SkillsBuild', category: 'Education', region: 'Global', url: 'https://skillsbuild.org/university/students', note: 'University skills learning; some activities require a partner institution.' },
  { name: 'Khan Academy', category: 'Education', region: 'Global', url: 'https://www.khanacademy.org/', note: 'School subject learning and practice. Teachers should check grade alignment.' },
  { name: 'freeCodeCamp', category: 'Education', region: 'Global', url: 'https://www.freecodecamp.org/learn', note: 'Programming practice and self-paced learning.' },
  { name: 'UN Careers', category: 'Work', region: 'Global', url: 'https://careers.un.org/jobs', note: 'Official vacancies. Nationality, experience, location and deadlines vary.' },
  { name: 'UN Volunteers', category: 'Volunteering', region: 'Global', url: 'https://www.unv.org/become-volunteer/', note: 'Volunteering information. Volunteering is not a promise of paid work.' },
] as const

export default function ResourceDirectory() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const rows = RESOURCES.filter(r => (!category || r.category === category) && `${r.name} ${r.note}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <details className="list-panel"><summary>Education & work websites</summary>
    <p>Seven official-source starting points checked against provider pages on 11 October 2026. This starter list is separate from scholarships and vacancies. Availability, age rules, fees and eligibility are set by each provider; listing is not an endorsement of every posting.</p>
    <div className="toolbar"><label>Search websites<input value={search} onChange={e => setSearch(e.target.value)} /></label><label>Website category<select value={category} onChange={e => setCategory(e.target.value)}><option value="">All</option>{['Education','Work','Volunteering'].map(c => <option key={c}>{c}</option>)}</select></label></div>
    <p role="status">{rows.length} websites</p>
    {rows.map(r => <article className="list-row" key={r.url}><div><h3>{r.name}</h3><p>{r.category} · {r.region}</p><p>{r.note}</p><small>{new URL(r.url).hostname}</small></div><a className="btn btn-secondary" href={safeExternalUrl(r.url)!} target="_blank" rel="noopener noreferrer">Open {r.name}</a></article>)}
    <p>Check the destination domain before entering personal information. Never send passwords or payment details to someone promising a job.</p>
  </details>
}
