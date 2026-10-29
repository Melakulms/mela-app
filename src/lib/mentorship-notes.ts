import { supabase } from './supabase'

export const NOTES_MAX = 2000
export const NOTES_UNAVAILABLE = 'Mentorship notes are not enabled in this environment yet.'
export type NotesDraft = { body: string | null; publishedRevision: number; updatedAt: string | null }

function throwNotesError(error: { code?: string; message?: string }): never {
  if (error.code === 'PGRST202' || /could not find the function|function .* does not exist/i.test(error.message ?? '')) {
    throw new Error(NOTES_UNAVAILABLE)
  }
  throw new Error(error.message || 'Mentorship notes could not be updated.')
}

export async function getNotesDraft(sessionId: string): Promise<NotesDraft> {
  const { data, error } = await supabase.rpc('get_mentorship_notes_draft', { p_session_id: sessionId })
  if (error) throwNotesError(error)
  const row = (data ?? {}) as { body?: string | null; published_revision?: number; updated_at?: string | null }
  return { body: row.body ?? null, publishedRevision: row.published_revision ?? 0, updatedAt: row.updated_at ?? null }
}

export async function saveNotesDraft(sessionId: string, body: string): Promise<void> {
  const clean = body.trim()
  if (clean.length > NOTES_MAX) throw new Error('Notes must be 2000 characters or fewer.')
  const { error } = await supabase.rpc('save_mentorship_notes_draft', { p_session_id: sessionId, p_body: clean || null })
  if (error) throwNotesError(error)
}

/** One atomic RPC uses the exact text being confirmed and an optimistic revision guard. */
export async function publishNotes(sessionId: string, text: string, expectedRevision: number): Promise<number> {
  const clean = text.trim()
  if (!clean || clean.length > NOTES_MAX) throw new Error('Enter 1 to 2000 characters of follow-up notes.')
  const { data, error } = await supabase.rpc('publish_mentorship_session_notes', {
    p_session_id: sessionId,
    p_body: clean,
    p_expected_revision: expectedRevision,
  })
  if (error) throwNotesError(error)
  const row = data as { notes_revision?: number } | null
  if (typeof row?.notes_revision !== 'number') throw new Error('The notes revision could not be confirmed.')
  return row.notes_revision
}
