import { supabase } from './supabase'

export type MentorshipGoal = {
  id: string; learner_id: string; title: string; detail: string
  status: 'planned' | 'in_progress' | 'completed' | 'paused'
  target_date: string | null; created_at: string
}
export type MentorshipAssignment = {
  id: string; request_id: string; mentor_id: string; learner_id: string
  title: string; instructions: string; due_at: string | null; created_at: string
}
export type MentorshipSubmission = {
  id: string; assignment_id: string; learner_id: string; response: string; created_at: string
}
export type MentorshipFeedback = {
  id: string; assignment_id: string; mentor_id: string; feedback: string; created_at: string
}
export type MentorshipResource = {
  id: string; title: string; category: string; description: string; content: string
}
export type MentorshipGroup = {
  id: string; title: string; category: string; description: string
  mentor_id: string; starts_at: string | null; capacity: number
}
export type MentorshipWorkspace = {
  goals: MentorshipGoal[]
  assignments: MentorshipAssignment[]
  submissions: MentorshipSubmission[]
  feedback: MentorshipFeedback[]
  resources: MentorshipResource[]
  groups: MentorshipGroup[]
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('Please sign in to continue.')
  return data.user.id
}

function assertText(value: string, label: string, min: number, max: number) {
  const text = value.trim()
  if (text.length < min || text.length > max) throw new Error(label + ' must be ' + min + '–' + max + ' characters.')
  return text
}

export async function loadMentorshipWorkspace(role: 'learner' | 'mentor'): Promise<MentorshipWorkspace> {
  const id = await currentUser()
  const assignmentField = role === 'mentor' ? 'mentor_id' : 'learner_id'
  const queries = await Promise.all([
    role === 'mentor' ? Promise.resolve({ data: [], error: null }) : supabase.from('mentorship_goals')
      .select('id,learner_id,title,detail,status,target_date,created_at').eq('learner_id', id).order('created_at', { ascending: false }).limit(100),
    supabase.from('mentorship_assignments')
      .select('id,request_id,mentor_id,learner_id,title,instructions,due_at,created_at')
      .eq(assignmentField, id).order('created_at', { ascending: false }).limit(100),
    supabase.from('mentorship_resources')
      .select('id,title,category,description,content')
      .eq('status', 'published').order('title', { ascending: true }).limit(100),
    supabase.from('mentorship_groups')
      .select('id,title,description,category,mentor_id,starts_at,capacity')
      .eq('status', 'published').gt('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }).limit(50),
  ])
  for (const result of queries) if (result.error) throw result.error
  const assignments = (queries[1].data ?? []) as MentorshipAssignment[]
  const ids = assignments.map((assignment) => assignment.id)
  const [submissions, feedback] = ids.length ? await Promise.all([
    supabase.from('mentorship_submissions').select('id,assignment_id,learner_id,response,created_at').in('assignment_id', ids),
    supabase.from('mentorship_feedback').select('id,assignment_id,mentor_id,feedback,created_at').in('assignment_id', ids),
  ]) : [{ data: [], error: null }, { data: [], error: null }]
  if (submissions.error) throw submissions.error
  if (feedback.error) throw feedback.error
  return {
    goals: (queries[0].data ?? []) as MentorshipGoal[],
    assignments, submissions: (submissions.data ?? []) as MentorshipSubmission[],
    feedback: (feedback.data ?? []) as MentorshipFeedback[],
    resources: (queries[2].data ?? []) as MentorshipResource[],
    groups: (queries[3].data ?? []) as MentorshipGroup[],
  }
}

export async function addMentorshipGoal(title: string, detail: string, targetDate = '') {
  const id = await currentUser()
  const { error } = await supabase.from('mentorship_goals').insert({
    learner_id: id,
    title: assertText(title, 'Goal title', 3, 160),
    detail: detail.trim().slice(0, 2000),
    target_date: targetDate || null,
  })
  if (error) throw error
}

export async function setMentorshipGoalStatus(goalId: string, status: MentorshipGoal['status']) {
  if (!['planned','in_progress','completed','paused'].includes(status)) throw new Error('Invalid goal status.')
  const id = await currentUser()
  const { data, error } = await supabase.from('mentorship_goals')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', goalId).eq('learner_id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Goal was not updated. Review your permissions and retry.')
}

export async function deleteMentorshipGoal(goalId: string) {
  const id = await currentUser()
  const { error } = await supabase.from('mentorship_goals').delete().eq('id', goalId).eq('learner_id', id)
  if (error) throw error
}

export async function createMentorshipAssignment(
  requestId: string, learnerId: string, title: string, instructions: string, due = '',
) {
  const mentorId = await currentUser()
  const { error } = await supabase.from('mentorship_assignments').insert({
    request_id: requestId, mentor_id: mentorId, learner_id: learnerId,
    title: assertText(title, 'Assignment title', 3, 160),
    instructions: assertText(instructions, 'Instructions', 10, 4000),
    due_at: due ? new Date(due).toISOString() : null,
  })
  if (error) throw error
}

export async function submitMentorshipAssignment(assignmentId: string, response: string) {
  const learnerId = await currentUser()
  const { error } = await supabase.from('mentorship_submissions').insert({
    assignment_id: assignmentId, learner_id: learnerId,
    response: assertText(response, 'Answer', 2, 4000),
  })
  if (error) throw error
}

export async function sendMentorshipFeedback(assignmentId: string, feedback: string) {
  const mentorId = await currentUser()
  const { error } = await supabase.from('mentorship_feedback').insert({
    assignment_id: assignmentId, mentor_id: mentorId,
    feedback: assertText(feedback, 'Feedback', 2, 4000),
  })
  if (error) throw error
}

export function assignmentProgress(workspace: MentorshipWorkspace): { assigned: number; submitted: number; reviewed: number } {
  const ids = new Set(workspace.assignments.map((row) => row.id))
  return {
    assigned: ids.size,
    submitted: workspace.submissions.filter((row) => ids.has(row.assignment_id)).length,
    reviewed: workspace.feedback.filter((row) => ids.has(row.assignment_id)).length,
  }
}
