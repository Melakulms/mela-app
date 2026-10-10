import type { ChatTurn } from './coach-history'
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

export async function askCareerCoach(message: string, history:ChatTurn[]=[], language='en'): Promise<CoachResult> {
  if(!message.trim()||message.length>6000)return {kind:'error',message:'Enter a question of 1 to 6000 characters.'}
  const { data, error } = await supabase.functions.invoke('mela-ai-execution-v2', {
    body: { message, history:history.slice(-6).map(turn=>({role:turn.role==='coach'?'assistant':'user',content:turn.text.slice(0,2000)})), language },
  })
  if (error) {
    const status = (error as any)?.context?.status
    if (status === 202) return { kind: 'approval_required' }
    const detail=error.context instanceof Response?await error.context.clone().json().catch(()=>null):null
    return {kind:'error',message:typeof detail?.error==='string'?detail.error:error.message??'The AI coach is unavailable right now.'}
  }
  if (data?.ok === false && data?.mode === 'approval_required') {
    return { kind: 'approval_required' }
  }
  if (!data?.ok) {
    return { kind: 'error', message: data?.error ?? 'The AI coach could not answer that.' }
  }
  if (typeof data.response !== 'string' || !data.response.trim()) {
    return { kind: 'error', message: 'The AI coach returned an empty reply. Please try again.' }
  }
  return { kind: 'reply', reply: { response: data.response, agent: data.agent, tool: data.tool } }
}
