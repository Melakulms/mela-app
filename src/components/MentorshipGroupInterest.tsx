import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { MentorshipGroup } from '../lib/mentorship-workspace'

type Interest = { id: string; group_id: string; status: string }
type Attendance = { interest_id: string; status: 'reported_present' | 'reported_absent' }
export default function MentorshipGroupInterest({ groups }: { groups: MentorshipGroup[] }) {
  const [interests, setInterests] = useState<Interest[]>([])
  const [attendance, setAttendance] = useState<Attendance[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [membershipAvailable, setMembershipAvailable] = useState(false)
  const [revision, setRevision] = useState(0)
  const [busyGroup, setBusyGroup] = useState<string | null>(null)
  const lock = useRef(false)

  useEffect(() => {
    let active = true
    setLoading(true);setMembershipAvailable(false);setError('');setInterests([]);setAttendance([])
    void (async () => {
      try {
        const { data: auth, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!auth.user) throw new Error('Sign in to see your group program status.')
        const { data, error: readError } = await supabase.from('mentorship_group_interests')
          .select('id,group_id,status').eq('learner_id',auth.user.id)
        if (readError) throw new Error(readError.message)
        const ownInterests = (data ?? []) as Interest[]
        const approvedIds = ownInterests.filter(i => i.status === 'approved').map(i => i.id)
        let ownAttendance: Attendance[] = []
        if (approvedIds.length) {
          const { data: records, error: attendanceError } = await supabase
            .from('mentorship_group_attendance').select('interest_id,status').in('interest_id', approvedIds)
          if (attendanceError) throw new Error(attendanceError.message)
          ownAttendance = (records ?? []) as Attendance[]
        }
        if (active) { setInterests(ownInterests);setAttendance(ownAttendance);setMembershipAvailable(true) }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load group interest status.')
      } finally { if (active) setLoading(false) }
    })()
    return () => { active = false }
  }, [revision])

  const mutate = async (groupId: string, action: 'express'|'withdraw') => {
    if (lock.current || loading || !membershipAvailable) {
      if (!loading && !membershipAvailable) setError('Your group request history is unavailable. Refresh and verify it before changing participation.')
      return
    }
    lock.current = true;setBusyGroup(groupId);setNotice('');setError('')
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Sign in to manage your group interest.')
      if (action === 'express') {
        const { error: insertError } = await supabase.from('mentorship_group_interests')
          .insert({ group_id:groupId, learner_id:auth.user.id })
        if (insertError) throw new Error(insertError.message)
        setNotice('Interest submitted. No meeting or place is confirmed until a qualified administrator reviews it.')
      } else {
        const interest = interests.find((item) => item.group_id===groupId && item.status==='pending')
        if (!interest) throw new Error('Only pending interests can be withdrawn here.')
        const { data: deleted, error: deleteError } = await supabase.from('mentorship_group_interests')
          .delete().eq('id',interest.id).eq('learner_id',auth.user.id).eq('status','pending').select('id')
        if (deleteError) throw new Error(deleteError.message)
        if (!deleted?.length) throw new Error('Your request was not withdrawn. Refresh the current approval status before trying again.')
        setNotice('Your pending interest was withdrawn.')
      }
      setRevision((n) => n+1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update group interest.')
    } finally {setBusyGroup(null);lock.current=false}
  }

  return <div aria-label="Group mentorship interest">
    <p>Group participation is currently restricted to verified eligible adult university or TVET learners. Publishing a group does not start a call or private chat.</p>
    {error && <div className="banner banner-error" role="alert">{error}</div>}
    {notice && <p role="status" className="banner banner-info">{notice}</p>}
    {loading && <p role="status">Checking your group participation requests…</p>}
    {!loading && !membershipAvailable && <div role="status" className="banner banner-info">
      Your group request history could not be verified. No new group applications or withdrawals are allowed until it loads.
      <button type="button" className="btn btn-secondary" onClick={() => setRevision(n=>n+1)}>Retry group status</button>
    </div>}
    {groups.length===0 && <p className="muted">No approved group programs currently published. MELA will not show placeholder sessions.</p>}
    {groups.length>0 && <div className="list-panel">{groups.map((group) => {
      const existing = interests.find((item) => item.group_id===group.id)
      return <article className="list-row" key={group.id}>
        <div style={{ flex:1 }}>
          <strong>{group.title}</strong><p>{group.description}</p>
          <p className="muted">{group.category} · Capacity {group.capacity}{group.starts_at ? ` · Starts ${new Date(group.starts_at).toLocaleString()}` : ''}</p>
          {existing && <p role="status">Application: {existing.status==='approved' ? 'Approved by an administrator' : existing.status==='declined' ? 'Declined' : 'Awaiting approval'}</p>}
        </div>
        {existing?.status==='pending' ?
          <button type="button" className="btn btn-secondary" disabled={loading || !membershipAvailable || !!busyGroup} onClick={() => void mutate(group.id,'withdraw')}>Withdraw interest</button> :
          !existing ? <button type="button" className="btn btn-primary" disabled={loading || !membershipAvailable || !!busyGroup} onClick={() => void mutate(group.id,'express')}>Request to join</button> : null}
      </article>
    })}</div>}
    {membershipAvailable && interests.some(i => i.status === 'approved') && <section aria-label="My group attendance history">
      <h3>Approved group program history</h3>
      {interests.filter(i => i.status === 'approved').map(i => {
        const program = groups.find(g => g.id === i.group_id)
        const report = attendance.find(a => a.interest_id === i.id)
        return <p key={i.id}>
          {program?.title ?? `Group ${i.group_id.slice(0,8)}`}: {report
            ? report.status === 'reported_present' ? 'Administrator reported attendance' : 'Administrator reported absence'
            : 'Attendance not reported'}. Approval is not proof of a completed meeting or achievement.
        </p>
      })}
    </section>}
    <p className="muted">Do not exchange private contact information or join off-platform sessions. All requests are subject to MELA eligibility and safeguarding checks.</p>
  </div>
}
