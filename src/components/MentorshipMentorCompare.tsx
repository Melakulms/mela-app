import type { Mentor } from '../lib/mentorship'
import { WEEKDAYS } from '../lib/mentor-discovery'

/** Compares only approved profiles already returned by the verified directory API.
 * This is a comparison of public fields, not a qualification or availability check. */
export default function MentorshipMentorCompare({
  mentors, selectedIds, onToggle, onClear,
}: {
  mentors: Mentor[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onClear: () => void
}) {
  const byId = new Map(mentors.map(mentor => [mentor.user_id, mentor]))
  const selected = selectedIds.map(id => byId.get(id)).filter((mentor): mentor is Mentor => !!mentor)

  return <section className="empty-panel" style={{ textAlign: 'left' }}
    aria-label="Compare verified mentor profiles">
    <h2>Compare verified mentors</h2>
    <p>Choose up to three published mentor profiles from the directory. Compare their stated fields, languages and weekly hours before you decide whom to request. This is not an independent credential rating or a booking.</p>
    <p role="status">{selected.length} of 3 profiles selected for comparison.</p>
    {selected.length > 0 && <button type="button" className="btn btn-secondary" onClick={onClear}>Clear comparison</button>}
    {selected.length === 0 ? <p className="muted">No profiles selected. Use “Add to comparison” on a verified mentor card below.</p> :
      <div style={{ overflowX:'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth:'18rem' }}>
          <caption style={{ textAlign:'left',marginBottom:'.5rem' }}>Published profiles only; rates and available hours can change.</caption>
          <thead><tr><th scope="col">Published field</th>{selected.map(mentor =>
            <th scope="col" key={mentor.user_id}>{mentor.full_name || 'Verified mentor'}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">Focus</th>{selected.map(mentor =>
              <td key={mentor.user_id}>{mentor.headline || 'Not provided'}</td>)}</tr>
            <tr><th scope="row">Organization</th>{selected.map(mentor =>
              <td key={mentor.user_id}>{mentor.organization || 'Not provided'}</td>)}</tr>
            <tr><th scope="row">Expertise</th>{selected.map(mentor =>
              <td key={mentor.user_id}>{mentor.expertise?.join(', ') || 'Not provided'}</td>)}</tr>
            <tr><th scope="row">Languages</th>{selected.map(mentor =>
              <td key={mentor.user_id}>{mentor.languages?.join(', ') || 'Not provided'}</td>)}</tr>
            <tr><th scope="row">Experience</th>{selected.map(mentor =>
              <td key={mentor.user_id}>{mentor.years_experience == null ? 'Not provided' : mentor.years_experience + ' years listed'}</td>)}</tr>
            <tr><th scope="row">Completed-session ratings</th>{selected.map(mentor =>
              <td key={mentor.user_id}>{mentor.rating_count > 0 ?
                mentor.rating_average.toFixed(2) + '/5 from ' + mentor.rating_count + ' ratings' : 'Not yet rated'}</td>)}</tr>
            <tr><th scope="row">Published weekly hours</th>{selected.map(mentor =>
              <td key={mentor.user_id}>{(mentor.availability ?? []).length ?
                <ul>{mentor.availability!.map(slot => <li key={slot.id}>
                  {WEEKDAYS[slot.weekday] || 'Day'} {slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)} ({slot.timezone})
                </li>)}</ul> : 'No hours published'}</td>)}</tr>
            <tr><th scope="row">Selection</th>{selected.map(mentor =>
              <td key={mentor.user_id}><button type="button" className="btn btn-secondary"
                onClick={() => onToggle(mentor.user_id)}>Remove {mentor.full_name || 'mentor'}</button></td>)}</tr>
          </tbody>
        </table>
      </div>}
    <p className="muted">Only an eligible learner can send a real request, and only an approved mentor can separately confirm a session. Profile comparison does not bypass guardian or adult eligibility checks.</p>
  </section>
}
