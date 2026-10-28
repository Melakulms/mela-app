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

export async function loadMentorshipWorkspace(role: 'learner' | 'mentor', section: number | null = null): Promise<MentorshipWorkspace> {
  const id = await currentUser()
  const assignmentField = role === 'mentor' ? 'mentor_id' : 'learner_id'
  const needs = (...sections: number[]) => section === null || sections.includes(section)
  // The mentor panel only needs work assigned to their own accepted learners.
  // Avoid unrelated learner-only resource and group endpoints denying access
  // and unintentionally hiding the mentor's real assignments.
  const wantGoals = role === 'learner' && needs(9,12)
  const wantAssignments = role === 'mentor' || needs(11,12)
  const wantResources = role === 'learner' && needs(10)
  const wantGroups = role === 'learner' && needs(13)
  const empty = () => Promise.resolve({ data: [], error: null })
  const queries = await Promise.all([
    !wantGoals ? empty() : supabase.from('mentorship_goals')
      .select('id,learner_id,title,detail,status,target_date,created_at').eq('learner_id', id).order('created_at', { ascending: false }).limit(100),
    !wantAssignments ? empty() : supabase.from('mentorship_assignments')
      .select('id,request_id,mentor_id,learner_id,title,instructions,due_at,created_at')
      .eq(assignmentField, id).order('created_at', { ascending: false }).limit(100),
    !wantResources ? empty() : supabase.from('mentorship_resources')
      .select('id,title,category,description,content')
      .eq('status', 'published').order('title', { ascending: true }).limit(100),
    !wantGroups ? empty() : supabase.from('mentorship_groups')
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

export function validatedGoalTargetDate(targetDate: string): string | null {
  if (!targetDate) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error('Choose a valid target date for your goal or leave it blank.')
  const date = new Date(targetDate)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== targetDate) {
    throw new Error('Choose a valid target date for your goal or leave it blank.')
  }
  return targetDate
}

export async function addMentorshipGoal(title: string, detail: string, targetDate = '') {
  const id = await currentUser()
  const cleanTitle = assertText(title, 'Goal title', 3, 160)
  if (detail.trim().length > 2000) throw new Error('Goal plan must be 2000 characters or fewer.')
  const safeDate = validatedGoalTargetDate(targetDate)
  const { data, error } = await supabase.from('mentorship_goals').insert({
    learner_id: id,
    title: cleanTitle,
    detail: detail.trim(),
    target_date: safeDate,
  }).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Goal was not confirmed by the database. Refresh before retrying.')
}

export async function updateMentorshipGoal(
  goalId: string, title: string, detail: string, targetDate: string,
) {
  const id = await currentUser()
  const cleanTitle = assertText(title, 'Goal title', 3, 160)
  if (detail.trim().length > 2000) throw new Error('Goal plan must be 2000 characters or fewer.')
  const safeDate = validatedGoalTargetDate(targetDate)
  const { data, error } = await supabase.from('mentorship_goals')
    .update({ title:cleanTitle, detail:detail.trim(), target_date:safeDate, updated_at:new Date().toISOString() })
    .eq('id', goalId).eq('learner_id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Goal changes were not saved. Check permissions and retry.')
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
  const { data, error } = await supabase.from('mentorship_goals')
    .delete().eq('id', goalId).eq('learner_id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Goal was not deleted. Review your permissions and retry.')
}

export function validatedAssignmentDue(due: string, now = Date.now()): string {
  const date = new Date(due)
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now) {
    throw new Error('Assignment due date must be a valid future date and time.')
  }
  return date.toISOString()
}

export async function createMentorshipAssignment(
  requestId: string, learnerId: string, title: string, instructions: string, due = '',
) {
  const mentorId = await currentUser()
  const cleanTitle = assertText(title, 'Assignment title', 3, 160)
  const cleanInstructions = assertText(instructions, 'Instructions', 10, 4000)
  const dueAt = due ? validatedAssignmentDue(due) : null
  const { data, error } = await supabase.from('mentorship_assignments').insert({
    request_id: requestId, mentor_id: mentorId, learner_id: learnerId,
    title: cleanTitle,
    instructions: cleanInstructions,
    due_at: dueAt,
  }).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Assignment was not confirmed by the database. Refresh before retrying.')
}

export async function submitMentorshipAssignment(assignmentId: string, response: string) {
  const learnerId = await currentUser()
  const cleanAnswer = assertText(response, 'Answer', 2, 4000)
  const { data, error } = await supabase.from('mentorship_submissions').insert({
    assignment_id: assignmentId, learner_id: learnerId, response: cleanAnswer,
  }).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Your assignment response was not confirmed by the database. Refresh before retrying.')
}

export async function sendMentorshipFeedback(assignmentId: string, feedback: string) {
  const mentorId = await currentUser()
  const cleanFeedback = assertText(feedback, 'Feedback', 2, 4000)
  const { data, error } = await supabase.from('mentorship_feedback').insert({
    assignment_id: assignmentId, mentor_id: mentorId, feedback: cleanFeedback,
  }).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Mentor feedback was not confirmed by the database. Refresh before retrying.')
}

export function assignmentProgress(workspace: MentorshipWorkspace): { assigned: number; submitted: number; reviewed: number } {
  const ids = new Set(workspace.assignments.map(row => row.id))
  const submittedIds = new Set(workspace.submissions.map(row => row.assignment_id).filter(id => ids.has(id)))
  const reviewedIds = new Set(workspace.feedback.map(row => row.assignment_id).filter(id => ids.has(id) && submittedIds.has(id)))
  return { assigned: ids.size, submitted: submittedIds.size, reviewed: reviewedIds.size }
}

export type MentorshipActionSummary = {
  activeGoals: number
  overdueGoals: number
  assignmentsToSubmit: number
  overdueAssignments: number
  awaitingFeedback: number
}
export function mentorshipActionSummary(workspace: MentorshipWorkspace, now = new Date()): MentorshipActionSummary {
  // Goal target_date is a calendar date, not a UTC instant. Match the
  // learner's local date so yesterday is overdue but today is not.
  const today = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'),
    String(now.getDate()).padStart(2,'0')].join('-')
  const submitted = new Set(workspace.submissions.map(row => row.assignment_id))
  const reviewed = new Set(workspace.feedback.map(row => row.assignment_id).filter(id => submitted.has(id)))
  const goals = workspace.goals.filter(row => row.status === 'planned' || row.status === 'in_progress')
  const pending = workspace.assignments.filter(row => !submitted.has(row.id))
  return {
    activeGoals: goals.length,
    overdueGoals: goals.filter(row => row.target_date && row.target_date < today).length,
    assignmentsToSubmit: pending.length,
    overdueAssignments: pending.filter(row => row.due_at && Number.isFinite(Date.parse(row.due_at))
      && Date.parse(row.due_at) < now.getTime()).length,
    awaitingFeedback: workspace.assignments.filter(row => submitted.has(row.id) && !reviewed.has(row.id)).length,
  }
}
