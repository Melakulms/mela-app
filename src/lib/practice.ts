import { supabase } from './supabase'

export interface PracticeTopic {
  id: string
  subject: string
  topic: string
  grade_level: number | null
  description: string | null
}

export interface PracticeQuestion {
  question_order: number
  question_id: string
  question: string
  choices: string[] | null
  question_type: string
  max_points: number
}

export interface SubmitResult {
  is_correct: boolean | null
  score: number | null
  max_points: number
  feedback: string
  auto_graded: boolean
}

export interface SessionSummary {
  correct: number
  answered: number
  session_id: string
  score_percent: number
  topic_mastery: { mastery_level: string; mastery_score: number }[]
}

export async function fetchTopics(): Promise<PracticeTopic[]> {
  const { data, error } = await supabase
    .from('practice_topics')
    .select('id, subject, topic, grade_level, description')
    .eq('is_published', true)
    .order('subject')
  if (error) throw error
  return data as PracticeTopic[]
}

export async function startSession(topicId: string, questionCount = 5): Promise<string> {
  const { data, error } = await supabase.rpc('start_practice_session', {
    p_topic_id: topicId,
    p_mode: 'weak_skill',
    p_question_count: questionCount,
    p_difficulty: 1,
  })
  if (error) throw error
  return data as string
}

export async function fetchSessionQuestions(sessionId: string): Promise<PracticeQuestion[]> {
  const { data, error } = await supabase
    .from('practice_session_questions')
    .select('question_order, question_id, max_points, practice_questions(question, choices, question_type)')
    .eq('session_id', sessionId)
    .order('question_order')
  if (error) throw error
  return (data as any[]).map((row) => ({
    question_order: row.question_order,
    question_id: row.question_id,
    max_points: Number(row.max_points),
    question: row.practice_questions.question,
    choices: row.practice_questions.choices,
    question_type: row.practice_questions.question_type,
  }))
}

export async function submitResponse(sessionId: string, questionId: string, answer: string, timeSpentSeconds: number): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_practice_response', {
    p_session_id: sessionId,
    p_question_id: questionId,
    p_response: { answer },
    p_time_spent_seconds: timeSpentSeconds,
    p_attachment_path: null,
  })
  if (error) throw error
  return data as SubmitResult
}

export async function completeSession(sessionId: string): Promise<SessionSummary> {
  const { data, error } = await supabase.rpc('complete_practice_session', { p_session_id: sessionId })
  if (error) throw error
  return data as SessionSummary
}
