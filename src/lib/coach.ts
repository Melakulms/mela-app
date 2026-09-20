import { supabase } from './supabase'

export interface CoachReply {
  response: string
  agent: { key: string; name: string; domain: string }
  tool: string | null
}

export type CoachResult =
  | { kind: 'reply'; reply: CoachReply }
  | { kind: 'approval_required' }
  | { kind: 'error'; message: string }

export async function askCareerCoach(message: string): Promise<CoachResult> {
  const { data, error } = await supabase.functions.invoke('mela-ai-execution-v2', {
    body: { message },
  })
  if (error) {
    const status = (error as any)?.context?.status
    if (status === 202) return { kind: 'approval_required' }
    return { kind: 'error', message: error.message ?? 'The AI coach is unavailable right now.' }
  }
  if (data?.ok === false && data?.mode === 'approval_required') {
    return { kind: 'approval_required' }
  }
  if (!data?.ok) {
    return { kind: 'error', message: data?.error ?? 'The AI coach could not answer that.' }
  }
  return { kind: 'reply', reply: { response: data.response, agent: data.agent, tool: data.tool } }
}
