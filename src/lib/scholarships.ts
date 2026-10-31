import { supabase } from './supabase'

export interface Scholarship { id:string; title:string; description?:string|null; institution:string|null; program_name:string|null; study_country:string|null; degree_levels:string[]; fields_of_study:string[]; eligible_countries:string[]; minimum_gpa:number|null; funding_type:string|null; coverage:string[]; award_amount:number|null; award_currency:string|null; deadline:string|null; application_fee:number|null; application_fee_currency:string|null; required_documents:string[]; language_requirements:string[]; requirements:string[]; application_method:string; external_url:string|null; source_url:string|null; verified_at:string|null }
export interface ScholarshipApplication { id:string; opportunity_id:string; status:string; applied_at:string; updated_at:string; title:string; institution:string|null }
export interface ScholarshipTask { id:string; opportunity_id:string; application_id:string|null; title:string; task_type:string; due_at:string|null; completed:boolean }
export async function fetchOpenScholarships():Promise<Scholarship[]> { const today=new Date().toISOString().slice(0,10); const {data,error}=await supabase.from('opportunities').select('id,title,description,deadline,application_method,external_url,source_url,source_verified_at,requirements,scholarship_details(institution,program_name,study_country,degree_levels,fields_of_study,eligible_countries,minimum_gpa,funding_type,coverage,award_amount,award_currency,application_fee,application_fee_currency,required_documents,language_requirements)').eq('status','open').eq('moderation_status','approved').eq('verified_active',true).eq('opportunity_type','scholarships').or('deadline.is.null,deadline.gte.'+today).order('deadline',{ascending:true,nullsFirst:false}).limit(100); if(error)throw error; return (data as any[]).map(r=>{const d=r.scholarship_details||{};return {id:r.id,title:r.title,description:r.description,deadline:r.deadline,application_method:r.application_method,external_url:r.external_url||null,source_url:r.source_url||r.external_url||null,verified_at:r.source_verified_at||null,requirements:r.requirements||[],institution:d.institution||null,program_name:d.program_name||null,study_country:d.study_country||null,degree_levels:d.degree_levels||[],fields_of_study:d.fields_of_study||[],eligible_countries:d.eligible_countries||[],minimum_gpa:d.minimum_gpa||null,funding_type:d.funding_type||null,coverage:d.coverage||[],award_amount:d.award_amount||null,award_currency:d.award_currency||null,application_fee:d.application_fee||null,application_fee_currency:d.application_fee_currency||null,required_documents:d.required_documents||[],language_requirements:d.language_requirements||[]}}) }
export async function fetchScholarshipApplications():Promise<ScholarshipApplication[]> {const {data,error}=await supabase.from('applications').select('id,opportunity_id,status,applied_at,updated_at,opportunities!inner(title,opportunity_type,scholarship_details(institution))').eq('opportunities.opportunity_type','scholarships').order('updated_at',{ascending:false});if(error)throw error;return (data||[]).map((r:any)=>({id:r.id,opportunity_id:r.opportunity_id,status:r.status,applied_at:r.applied_at,updated_at:r.updated_at,title:r.opportunities?.title||'Scholarship',institution:r.opportunities?.scholarship_details?.institution||null}))}
async function scholarshipOwnerId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Please sign in again before saving scholarships.')
  return data.user.id
}
export async function fetchSavedScholarshipIds(): Promise<Set<string>> {
  const userId = await scholarshipOwnerId()
  const { data, error } = await supabase.from('scholarship_saved')
    .select('opportunity_id').eq('user_id', userId)
  if (error) throw error
  return new Set((data ?? []).map(row => row.opportunity_id))
}
export async function toggleSavedScholarship(id: string, saved: boolean): Promise<void> {
  const userId = await scholarshipOwnerId()
  if (saved) {
    const { data, error } = await supabase.from('scholarship_saved')
      .delete().eq('opportunity_id', id).eq('user_id', userId).select('id')
    if (error) throw error
    if (!data?.length) throw new Error('The bookmark was not removed. Reload Saved scholarships and try again.')
  } else {
    // user_id is NOT NULL in production. Never rely on an implicit default.
    const { data, error } = await supabase.from('scholarship_saved')
      .insert({ user_id: userId, opportunity_id: id }).select('id,opportunity_id').single()
    if (error) throw error
    if (!data?.id || data.opportunity_id !== id) throw new Error('The scholarship bookmark was not confirmed as saved.')
  }
}
export async function fetchScholarshipTasks():Promise<ScholarshipTask[]> {const {data,error}=await supabase.from('scholarship_application_tasks').select('id,opportunity_id,application_id,title,task_type,due_at,completed').order('completed').order('due_at',{ascending:true});if(error)throw error;return (data||[]) as ScholarshipTask[]}
export async function ensureScholarshipTasks(s:Scholarship,applicationId?:string){const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Sign in required');const titles=s.required_documents.length?s.required_documents:['Review eligibility requirements','Complete the official application form'];const rows=titles.map(title=>({user_id:user.id,opportunity_id:s.id,application_id:applicationId||null,title,task_type:'requirement',due_at:s.deadline?new Date(s.deadline+'T23:59:59').toISOString():null}));const {error}=await supabase.from('scholarship_application_tasks').upsert(rows,{onConflict:'user_id,opportunity_id,title'});if(error)throw error}
export async function checkScholarshipEligibility(opportunityId:string){const {data,error}=await supabase.rpc('check_scholarship_eligibility',{p_opportunity_id:opportunityId});if(error)throw error;return data}
export async function setScholarshipTaskCompleted(id: string, completed: boolean): Promise<void> {
  const userId = await scholarshipOwnerId()
  const { data, error } = await supabase.from('scholarship_application_tasks')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id).eq('user_id', userId).select('id,completed').single()
  if (error) throw error
  if (!data || data.id !== id || data.completed !== completed) {
    throw new Error('The checklist change was not confirmed. Please reload and try again.')
  }
}