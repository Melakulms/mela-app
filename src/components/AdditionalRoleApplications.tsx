import {useEffect, useState} from 'react'
import {supabase} from '../lib/supabase'

type Review = {status:string}
type PartnerType = {partner_type_key:string;title:string}

export function csvValues(value:string, max:number):string[]{
  return [...new Set(value.split(',').map(v=>v.trim()).filter(Boolean))].slice(0,max)
}

/** Applications are NOT additional permission grants. The existing database
 * constraints and RLS must permit the request, and the administrator must
 * independently verify eligibility and evidence before changing role access.
 */
export default function AdditionalRoleApplications({userId}:{userId:string}){
  const [mentor,setMentor]=useState<Review|null>(null)
  const [partner,setPartner]=useState<Review|null>(null)
  const [types,setTypes]=useState<PartnerType[]>([])
  const [headline,setHeadline]=useState('')
  const [expertise,setExpertise]=useState('')
  const [languages,setLanguages]=useState('')
  const [background,setBackground]=useState('')
  const [partnerType,setPartnerType]=useState('')
  const [organization,setOrganization]=useState('')
  const [website,setWebsite]=useState('')
  const [contact,setContact]=useState('')
  const [description,setDescription]=useState('')
  const [loading,setLoading]=useState(true)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [eligibleAdult,setEligibleAdult]=useState(false)

  useEffect(()=>{
    let active=true
    const load=async()=>{
      try {
        const {data:auth,error:authError}=await supabase.auth.getUser()
        if(authError)throw authError
        if(auth.user?.id!==userId)throw new Error('Sign in again to manage your role applications.')
        const [mentorResult,partnerResult,catalogResult]=await Promise.all([
          supabase.from('mentorship_applications').select('status').eq('applicant_id',userId).maybeSingle(),
          supabase.from('sector_partner_registration_requests').select('status').eq('requested_by',userId).order('created_at',{ascending:false}).limit(1).maybeSingle(),
          supabase.from('sector_partner_types').select('partner_type_key,title').order('display_order'),
        ])
        if(mentorResult.error||partnerResult.error||catalogResult.error)throw new Error('Your role application status could not be loaded.')
        if(!active)return
        setMentor(mentorResult.data)
        setPartner(partnerResult.data)
        setTypes(catalogResult.data??[])
      }catch(cause){if(active)setError(cause instanceof Error?cause.message:'Could not load role applications.')}
      finally{if(active)setLoading(false)}
    }
    void load()
    return()=>{active=false}
  },[userId])

  const checkIdentity=async()=>{
    const {data,error:authError}=await supabase.auth.getUser()
    if(authError||data.user?.id!==userId)throw new Error('Your login expired. Sign in again to submit an application.')
  }
  const applyMentor=async(event:React.FormEvent)=>{
    event.preventDefault();setError('');setNotice('')
    const skills=csvValues(expertise,12), langs=csvValues(languages,10)
    if(headline.trim().length<6||headline.trim().length>140||background.trim().length<30||background.trim().length>3000||!skills.length||!langs.length){
      setError('Enter your professional title, at least one expertise and language, and 30–3000 characters of background.');return
    }
    if(!eligibleAdult){setError('Mentorship applicants must confirm that they are eligible adults.');return}
    setBusy(true)
    try{
      await checkIdentity()
      const {error:submitError}=await supabase.from('mentorship_applications').insert({
        applicant_id:userId,headline:headline.trim(),expertise:skills,languages:langs,background:background.trim(),status:'pending_review',
      })
      if(submitError)throw submitError
      setMentor({status:'pending_review'})
      setNotice('Mentorship application submitted for independent review. No mentor booking rights were granted.')
    }catch(cause){setError(cause instanceof Error?cause.message:'Mentorship application was not accepted. Eligibility must be verified.')}
    finally{setBusy(false)}
  }
  const applyPartner=async(event:React.FormEvent)=>{
    event.preventDefault();setError('');setNotice('')
    if(!partnerType||!types.some(type=>type.partner_type_key===partnerType)||organization.trim().length<2){
      setError('Choose an available partnership type and enter the organization name.');return
    }
    if(!eligibleAdult){setError('The organization representative must confirm they are an adult.');return}
    if(contact.trim()&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim())){setError('Enter a valid work email or leave it blank.');return}
    setBusy(true)
    try{
      await checkIdentity()
      const {error:submitError}=await supabase.from('sector_partner_registration_requests').insert({
        requested_by:userId,partner_type_key:partnerType,organization_name:organization.trim(),
        website:website.trim()||null,contact_email:contact.trim()||null,description:description.trim()||null,status:'pending',
      })
      if(submitError)throw submitError
      setPartner({status:'pending'})
      setNotice('Partnership application submitted. Publication and learner access remain disabled until approved.')
    }catch(cause){setError(cause instanceof Error?cause.message:'Partnership application could not be submitted.')}
    finally{setBusy(false)}
  }

  return <section className="list-panel" aria-label="Additional professional role applications">
    <h2>Apply for another MELA role</h2>
    <p className="muted">Keep your existing login and account. Applications for mentor or partner status are reviewed separately. Submitting one does not change your role or open protected tools.</p>
    {error&&<p role="alert" className="banner banner-error">{error}</p>}
    {notice&&<p role="status" className="banner banner-info">{notice}</p>}
    {loading?<p role="status">Checking eligibility and applications…</p>:<>
      <label htmlFor="additional-role-adult"><input id="additional-role-adult" type="checkbox" checked={eligibleAdult} onChange={e=>setEligibleAdult(e.target.checked)} disabled={busy}/> I confirm I am an adult authorized to apply in my own name (does not replace verification).</label>
      <h3>Mentor application</h3>
      {mentor?<p role="status">Application status: <strong>{mentor.status.replaceAll('_',' ')}</strong>. You cannot accept mentorship bookings until separately verified.</p>:<form onSubmit={e=>void applyMentor(e)}>
        <div className="field"><label htmlFor="mentor-application-title">Professional title (required)</label><input id="mentor-application-title" required minLength={6} maxLength={140} value={headline} onChange={e=>setHeadline(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="mentor-application-expertise">Areas of expertise (comma separated)</label><input id="mentor-application-expertise" required maxLength={500} value={expertise} onChange={e=>setExpertise(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="mentor-application-language">Mentoring languages (comma separated)</label><input id="mentor-application-language" required maxLength={300} value={languages} onChange={e=>setLanguages(e.target.value)} disabled={busy}/></div>
        <div className="field"><label htmlFor="mentor-application-background">Qualifications and relevant experience (required)</label><textarea id="mentor-application-background" required minLength={30} maxLength={3000} value={background} onChange={e=>setBackground(e.target.value)} disabled={busy}/></div>
        <p className="field-hint">The server currently accepts only eligible adult learners in qualifying higher education or independently approved teachers; additional professional categories need separate authorization support.</p>
        <button type="submit" className="btn btn-secondary" disabled={busy}>Apply as mentor</button>
      </form>}
      <h3>Partner organization application</h3>
      {partner&&partner.status!=='cancelled'?<p role="status">Latest partnership application: <strong>{partner.status}</strong>. Admin verification is required.</p>:types.length===0?
        <p role="status">Partner registration categories are not yet published for this environment. An application cannot be submitted until MELA activates the catalog.</p>:
        <form onSubmit={e=>void applyPartner(e)}>
          <div className="field"><label htmlFor="partner-application-type">Partnership category</label><select id="partner-application-type" required value={partnerType} onChange={e=>setPartnerType(e.target.value)} disabled={busy}><option value="">Choose category</option>{types.map(type=><option key={type.partner_type_key} value={type.partner_type_key}>{type.title}</option>)}</select></div>
          <div className="field"><label htmlFor="partner-organization-name">Organization name</label><input id="partner-organization-name" required minLength={2} maxLength={180} value={organization} onChange={e=>setOrganization(e.target.value)} disabled={busy}/></div>
          <div className="field"><label htmlFor="partner-work-email">Work email (optional)</label><input id="partner-work-email" type="email" maxLength={254} value={contact} onChange={e=>setContact(e.target.value)} disabled={busy}/></div>
          <div className="field"><label htmlFor="partner-site">Website (optional)</label><input id="partner-site" type="url" maxLength={300} value={website} onChange={e=>setWebsite(e.target.value)} disabled={busy}/></div>
          <div className="field"><label htmlFor="partner-description">Partnership purpose</label><textarea id="partner-description" maxLength={1600} value={description} onChange={e=>setDescription(e.target.value)} disabled={busy}/></div>
          <button type="submit" className="btn btn-secondary" disabled={busy}>Apply as organization partner</button>
        </form>}
    </>}
  </section>
}
