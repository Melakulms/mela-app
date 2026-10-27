import { useEffect, useRef, useState } from 'react'
import type { PassportRecord } from '../lib/passport-records'
import { fetchMyPassportVerificationRequests, requestPassportVerification, type PassportVerificationStatus, type PassportVerificationKind } from '../lib/passport-verification'

export default function PassportVerificationPanel({kind, records, onPendingChange}: {kind: PassportVerificationKind; records: PassportRecord[]; onPendingChange?: (ids: Set<string>) => void}) {
  const [requests,setRequests] = useState<PassportVerificationStatus[]>([])
  const [error,setError] = useState('')
  const [info,setInfo] = useState('')
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [selected,setSelected] = useState<string | null>(null)
  const [note,setNote] = useState('')
  const lock = useRef(false)
  const publishRequests = (rows: PassportVerificationStatus[]) => {
    setRequests(rows)
    onPendingChange?.(new Set(rows.filter(row => row.record_kind === kind && row.status === 'pending').map(row => row.record_id)))
  }
  const refresh = () => {
    let active = true
    setLoading(true);setError('')
    void fetchMyPassportVerificationRequests().then(rows=>{if(active)publishRequests(rows)}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Could not load verification statuses.')}).finally(()=>{if(active)setLoading(false)})
    return () => {active=false}
  }
  useEffect(()=>refresh(),[kind])
  const submit = async () => {
    if (!selected || lock.current) return
    lock.current=true;setSaving(true);setError('');setInfo('')
    try {
      await requestPassportVerification(kind,selected,note)
      setSelected(null);setNote('')
      setInfo('Verification request sent. Your record stays unverified until an authorized MELA reviewer approves it.')
      const rows=await fetchMyPassportVerificationRequests()
      publishRequests(rows)
    } catch(e) {setError(e instanceof Error?e.message:'Request failed. Please retry.')}
    finally {setSaving(false);lock.current=false}
  }
  return <section className="question-card" aria-label="Career Passport verification requests">
    <h3>Request record verification</h3>
    <p className="field-hint">Only authorized MELA reviewers can verify education and experience. Records are locked against editing or deletion while review is pending. Do not upload identity documents or paste private identity details here. Reviewers must independently confirm your claim before approval.</p>
    {loading && <p role="status">Checking verification requests…</p>}
    {error && <div role="alert">{error}<button className="btn btn-secondary" disabled={saving} onClick={()=>refresh()}>Retry</button></div>}
    {info && <p role="status">{info}</p>}
    {!loading && records.map(record=>{
      const last = requests.find(r=>r.record_id===record.id&&r.record_kind===kind)
      return <article key={record.id} className="list-row">
        <div>
          <strong>{record.institution ?? record.organization ?? record.title ?? 'Saved record'}</strong>
          <p>{record.verified?'Verified by MELA':last?.status==='pending'?'Awaiting reviewer decision':last?.status==='approved'?'Approved':last?.status==='rejected'?'Declined — changes may be required':'Self-reported, unverified'}</p>
          {last?.status==='rejected' && last.review_feedback && <p className="field-hint">Reviewer feedback: {last.review_feedback}</p>}
        </div>
        {!record.verified && last?.status!=='pending' && selected!==record.id &&
          <button className="btn btn-secondary" disabled={saving || !!selected} onClick={()=>{setSelected(record.id);setNote('');setError('');setInfo('')}}>Request verification</button>}
        {selected===record.id && <form onSubmit={e=>{e.preventDefault();void submit()}}>
          <label htmlFor={'verification-note-'+record.id}>Message to reviewer (optional)</label>
          <textarea id={'verification-note-'+record.id} disabled={saving} maxLength={600} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain how the reviewer can independently confirm your record. Do not include private identity details."/>
          <button className="btn btn-primary" disabled={saving} type="submit">{saving?'Submitting…':'Submit verification request'}</button>
          <button className="btn btn-secondary" disabled={saving} type="button" onClick={()=>{setSelected(null);setNote('')}}>Cancel</button>
        </form>}
      </article>
    })}
  </section>
}
