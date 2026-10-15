import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js'

/** A newer auth event always wins over the initial asynchronous snapshot. */
export function observeSession(
  auth: Pick<SupabaseClient['auth'], 'getSession' | 'onAuthStateChange'>,
  onSession: (session: Session | null, event: AuthChangeEvent) => void,
  onError: (error: unknown) => void,
): () => void {
  let active = true
  let receivedEvent = false
  // A stalled refresh must expose the existing Retry screen, not an endless
  // spinner. Keep listening so a later auth event can still restore access.
  let snapshotFinished = false
  const restoreTimer = setTimeout(() => {
    if (!active || receivedEvent || snapshotFinished) return
    snapshotFinished = true
    onError(new Error('Session restoration timed out. Please retry.'))
  }, 15000)
  const { data } = auth.onAuthStateChange((event, session) => {
    if (!active) return
    receivedEvent = true
    clearTimeout(restoreTimer)
    onSession(session, event)
  })
  void auth.getSession().then(({ data, error }) => {
    clearTimeout(restoreTimer)
    if (!active || receivedEvent || snapshotFinished) return
    snapshotFinished = true
    if (error) onError(error)
    else onSession(data.session, 'INITIAL_SESSION')
  }).catch((error: unknown) => {
    clearTimeout(restoreTimer)
    if (active && !receivedEvent && !snapshotFinished) {
      snapshotFinished = true
      onError(error)
    }
  })
  return () => {
    active = false
    clearTimeout(restoreTimer)
    data.subscription.unsubscribe()
  }
}
