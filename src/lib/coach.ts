import type { ChatTurn } from './coach-history'
import { supabase } from './supabase'
import { normalizeLanguageCode } from '../i18n'

export interface CoachReply {
  response: string
  agent: { key: string; name: string; domain: string }
  tool: string | null
}

export type CoachResult =
  | { kind: 'reply'; reply: CoachReply }
  | { kind: 'approval_required' }
  | { kind: 'error'; message: string }

export function explainCoachFailure(status: number | undefined, code?: string): string {
  if (status === 401) return 'Your session has expired. Sign in again to use the AI coach.'
  if (status === 403) return 'This account is not eligible to use this AI feature. Check your profile or account status.'
  if (status === 429 || code === 'AI_LIMIT_REACHED') return 'The AI daily request limit has been reached. Your question is saved here for later.'
  if (status === 503 || code === 'AI_DISABLED') return 'The AI service is currently unavailable. MELA administration needs to check the provider configuration and service status.'
  if (status === 502 || status === 500) return 'The AI service could not complete your request. Your question is still here; please try again later.'
  if (status === 400) return 'The AI request was rejected. Review your question and try again.'
  return 'Unable to reach the AI coach. Check your connection and try again.'
}

export async function askCareerCoach(message: string, history: ChatTurn[] = [], language = 'en'): Promise<CoachResult> {
  if (!message.trim() || message.length > 6000) return { kind: 'error', message: 'Enter a question of 1 to 6000 characters.' }
  try {
    const { data, error } = await supabase.functions.invoke('mela-ai-execution-v2', {
      body: {
        purpose: 'career_coach',
        message: message.trim(),
        history: history.slice(-6).map(turn => ({ role: turn.role === 'coach' ? 'assistant' : 'user', content: turn.text.slice(0, 2000) })),
        language: normalizeLanguageCode(language),
      },
    })
    const detail = error?.context instanceof Response ? await error.context.clone().json().catch(() => null) : null
    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status
      if (status === 202 || detail?.mode === 'approval_required') return { kind: 'approval_required' }
      return { kind: 'error', message: explainCoachFailure(status, detail?.code) }
    }
    if (data?.mode === 'approval_required' || data?.mode === 'approval') return { kind: 'approval_required' }
    if (!data?.ok || typeof data.response !== 'string' || !data.response.trim()) {
      return { kind: 'error', message: explainCoachFailure(data?.status, data?.code) }
    }
    return { kind: 'reply', reply: { response: data.response, agent: data.agent, tool: data.tool } }
  } catch {
    return { kind: 'error', message: explainCoachFailure(undefined) }
  }
}
