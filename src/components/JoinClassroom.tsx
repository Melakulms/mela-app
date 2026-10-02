import {useRef,useState} from 'react'
import {supabase} from '../lib/supabase'
export default function JoinClassroom(){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[joined,setJoined]=useState(false)
 const lock=useRef(false)
 const join=async(event:React.FormEvent)=>{
  event.preventDefault();if(lock.current||!code.trim())return
  lock.current=true;setBusy(true);setError('');setJoined(false)
  try{const {error}=await supabase.rpc('join_educator_classroom',{p_join_code:code.trim()});if(error)throw error;setJoined(true);setCode('')}
  catch(cause:any){setError(cause?.message??'Could not join the classroom. Please retry.')}
  finally{lock.current=false;setBusy(false)}
 }
 return <section><h2>Join your classroom</h2><p>Enter the code shared by your teacher. The classroom must match your education stage.</p>{error&&<div role="alert" className="banner banner-error">{error}</div>}{joined&&<p role="status">You joined the classroom. Your teacher can now see your classroom learning summary.</p>}<form onSubmit={join}><div className="field"><label htmlFor="classroom-code">Classroom code</label><input id="classroom-code" required disabled={busy} value={code} onChange={e=>setCode(e.target.value)} autoComplete="off"/></div><button className="btn btn-primary" disabled={busy||!code.trim()}>{busy?'Joining…':'Join classroom'}</button></form></section>
}
