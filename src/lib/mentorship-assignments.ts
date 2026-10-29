import { supabase } from './supabase'

export type MelaAssignment = {
  id:string; request_id:string; mentor_id:string; learner_id:string;
  title:string; instructions:string; due_at:string|null; created_at:string
}
export type MelaSubmission = {
  id:string; assignment_id:string; learner_id:string; response:string; created_at:string
}
export type MelaFeedback = {
  id:string; assignment_id:string; mentor_id:string; feedback:string; created_at:string
}
export type AcceptedMentorship = { id:string; mentee_id:string; topic:string|null }
export type AssignmentWorkspace = {
  assignments:MelaAssignment[]; submissions:MelaSubmission[];
  feedback:MelaFeedback[]; accepted:AcceptedMentorship[]
}
export type AssignmentRole = 'learner'|'mentor'

function textWithin(value:string,label:string,min:number,max:number):string {
  const clean=value.trim()
  if(clean.length<min||clean.length>max)
    throw new Error(label+' must contain '+min+' to '+max+' characters.')
  return clean
}

async function signedInId():Promise<string> {
  const {data,error}=await supabase.auth.getUser()
  if(error) throw error
  if(!data.user) throw new Error('Sign in again to manage assignments.')
  return data.user.id
}

export function assignmentDueIso(local:string, now=Date.now()):string|null {
  if(!local) return null
  const date=new Date(local)
  if(!Number.isFinite(date.getTime())||date.getTime()<=now)
    throw new Error('Choose a future deadline or leave it blank.')
  return date.toISOString()
}

export async function loadAssignmentWorkspace(role:AssignmentRole):Promise<AssignmentWorkspace> {
  const id=await signedInId()
  const ownerColumn=role==='mentor'?'mentor_id':'learner_id'
  const [tasks,linked]=await Promise.all([
    supabase.from('mentorship_assignments')
      .select('id,request_id,mentor_id,learner_id,title,instructions,due_at,created_at')
      .eq(ownerColumn,id).order('created_at',{ascending:false}).limit(100),
    role==='mentor'
      ? supabase.from('mentorship_requests').select('id,mentee_id,topic')
        .eq('mentor_id',id).eq('status','accepted')
        .order('created_at',{ascending:false}).limit(100)
      : Promise.resolve({data:[],error:null}),
  ])
  if(tasks.error) throw tasks.error
  if(linked.error) throw linked.error
  const assignments=(tasks.data||[]) as MelaAssignment[]
  const ids=assignments.map(item=>item.id)
  const [answers,reviews]=ids.length?await Promise.all([
    supabase.from('mentorship_submissions')
      .select('id,assignment_id,learner_id,response,created_at').in('assignment_id',ids),
    supabase.from('mentorship_feedback')
      .select('id,assignment_id,mentor_id,feedback,created_at').in('assignment_id',ids),
  ]):[{data:[],error:null},{data:[],error:null}]
  if(answers.error) throw answers.error
  if(reviews.error) throw reviews.error
  return {
    assignments,
    submissions:(answers.data||[]) as MelaSubmission[],
    feedback:(reviews.data||[]) as MelaFeedback[],
    accepted:(linked.data||[]) as AcceptedMentorship[],
  }
}

export async function createAssignment(request:AcceptedMentorship,title:string,instructions:string,dueLocal:string):Promise<void>{
  const mentorId=await signedInId()
  if(!request.id||!request.mentee_id||request.mentee_id===mentorId)
    throw new Error('Select an accepted mentorship request.')
  const {data,error}=await supabase.from('mentorship_assignments').insert({
    request_id:request.id, mentor_id:mentorId, learner_id:request.mentee_id,
    title:textWithin(title,'Title',3,160),
    instructions:textWithin(instructions,'Instructions',10,4000),
    due_at:assignmentDueIso(dueLocal),
  }).select('id').single()
  if(error) throw error
  if(!data?.id) throw new Error('Assignment was not confirmed. Refresh before retrying.')
}

export async function submitAssignment(assignmentId:string,response:string):Promise<void>{
  const learnerId=await signedInId()
  const {data,error}=await supabase.from('mentorship_submissions').insert({
    assignment_id:assignmentId,learner_id:learnerId,
    response:textWithin(response,'Response',2,4000),
  }).select('id').single()
  if(error) throw error
  if(!data?.id) throw new Error('Response was not confirmed. Refresh before retrying.')
}

export async function reviewAssignment(assignmentId:string,feedback:string):Promise<void>{
  const mentorId=await signedInId()
  const {data,error}=await supabase.from('mentorship_feedback').insert({
    assignment_id:assignmentId,mentor_id:mentorId,
    feedback:textWithin(feedback,'Feedback',2,4000),
  }).select('id').single()
  if(error) throw error
  if(!data?.id) throw new Error('Feedback was not confirmed. Refresh before retrying.')
}
