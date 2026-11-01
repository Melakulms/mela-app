import {lazy, Suspense, useEffect, useState, type ReactNode} from 'react'
import {RefreshCw} from 'lucide-react'
import {inspectMyProfileSetup} from '../lib/profile-diagnostics'

const SafetyCenter = lazy(() => import('./SafetyCenter'))
type Role = 'student' | 'parent' | 'teacher' | 'company' | 'employer'

export default function ProfileAccessHub({setup,onRefresh,onSignOut}:{
  role:Role;stageKey?:string|null;setup:ReactNode;onRefresh:()=>void;onSignOut:()=>void
}){
  const [showSafety,setShowSafety]=useState(false)
  const [message,setMessage]=useState('')
  const [diagnostic,setDiagnostic]=useState('')
  const [diagnosticBusy,setDiagnosticBusy]=useState(false)
  const checkSetup=async()=>{
    setDiagnosticBusy(true)
    try{setDiagnostic(await inspectMyProfileSetup())}
    catch{setDiagnostic('Could not inspect your account. Please reconnect to the internet and try again.')}
    finally{setDiagnosticBusy(false)}
  }
  useEffect(() => {
    const home = () => { setShowSafety(false); setDiagnostic(''); setMessage('') }
    window.addEventListener('mela:go-home', home)
    return () => window.removeEventListener('mela:go-home', home)
  }, [])
  return <div className="profile-access-hub">
    <header className="profile-access-header">
      <div><span className="auth-wordmark">MELA</span><span className="pill">Profile incomplete</span></div>
      <button type="button" className="btn btn-secondary" onClick={onSignOut}>Sign out</button>
    </header>
    <div className="profile-access-controls" role="navigation" aria-label="Required account setup">
      <button type="button" className="btn btn-primary" onClick={()=>setShowSafety(false)} aria-current={!showSafety?'page':undefined}>Complete my profile</button>
      <button type="button" className="btn btn-secondary" onClick={()=>void checkSetup()} disabled={diagnosticBusy}><RefreshCw size={16} aria-hidden="true"/> {diagnosticBusy?'Checking…':'Check account setup'}</button>
      <button type="button" className="btn btn-secondary" onClick={()=>{setMessage('Checking your saved information. MELA opens only after all required profile information is saved.');onRefresh()}}>Check saved profile</button>
      <button type="button" className="btn btn-secondary" onClick={()=>setShowSafety(true)}>Safety and support</button>
    </div>
    {message && <p role="status" className="profile-access-status">{message}</p>}
    {diagnostic && <section className="profile-access-diagnostic" aria-label="Account setup diagnostic">
      <h2>Account setup check</h2>
      <label htmlFor="profile-diagnostic">Your account flags</label>
      <textarea id="profile-diagnostic" readOnly value={diagnostic} rows={9} onFocus={event=>event.currentTarget.select()}/>
      <button type="button" className="btn btn-secondary" onClick={()=>void navigator.clipboard?.writeText(diagnostic).catch(()=>{})}>Copy account check</button>
    </section>}
    <div hidden={showSafety}>
      <div className="profile-access-intro" role="status">
        <strong>Complete your information before opening MELA features</strong>
        <p>Fill in the required fields below and save your profile. If saving fails, correct the highlighted information or check your connection and try again. Optional fields can be left empty.</p>
      </div>
      {setup}
    </div>
    {showSafety && <Suspense fallback={<p role="status">Loading safety and support…</p>}>
      <SafetyCenter onBack={()=>setShowSafety(false)}/>
    </Suspense>}
  </div>
}
