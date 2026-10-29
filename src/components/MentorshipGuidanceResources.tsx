import { useEffect, useState } from 'react'

type Guide = {
  id: string
  title: string
  category: string
  description: string
  content: string
  status: 'published'
}
const CACHE_KEY = 'mela-public-mentorship-guidance-v1'
const MAX_GUIDES = 50

/** Only non-personal published guidance is retained offline; never cache
 * session notes, requests, guardian details, Auth claims, or drafts. */
function readPublicCache(): Guide[] {
  try {
    const cached: unknown = JSON.parse(window.localStorage.getItem(CACHE_KEY) ?? 'null')
    if (!Array.isArray(cached)) return []
    return cached.slice(0, MAX_GUIDES).filter((value): value is Guide =>
      value && typeof value === 'object' && value.status === 'published' &&
      typeof value.id === 'string' && typeof value.title === 'string' &&
      typeof value.category === 'string' && typeof value.description === 'string' &&
      typeof value.content === 'string' &&
      value.title.length <= 160 && value.content.length <= 5000)
  } catch { return [] }
}
function writePublicCache(items: Guide[]): void {
  try { window.localStorage.setItem(CACHE_KEY, JSON.stringify(items)) }
  catch { /* Storage can be disabled on private/mobile browsers. */ }
}

export default function MentorshipGuidanceResources() {
  const [guides, setGuides] = useState<Guide[]>(() => readPublicCache())
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [offlineCache, setOfflineCache] = useState(false)
  useEffect(() => {
    let active = true
    setBusy(true); setError('')
    void (async () => {
      try {
        // Load the client when the resource panel is actually used. If an
        // offline/install session has no API configuration, cached public
        // guidance still works and does not prevent mentorship navigation.
        const { supabase } = await import('../lib/supabase')
        const { data, error: apiError } = await supabase
          .from('mentorship_resources')
          .select('id,title,category,description,content,status')
          .eq('status', 'published')
          .order('created_at', { ascending: true })
          .limit(MAX_GUIDES)
        if (apiError) throw apiError
        if (!active) return
        const publicGuides = (Array.isArray(data) ? data : []).filter(
          (row): row is Guide => row.status === 'published' &&
            typeof row.id === 'string' && typeof row.title === 'string' &&
            typeof row.category === 'string' && typeof row.description === 'string' &&
            typeof row.content === 'string'
        )
        setGuides(publicGuides)
        setOfflineCache(false)
        writePublicCache(publicGuides)
      } catch {
        if (!active) return
        const cached = readPublicCache()
        setGuides(cached)
        setOfflineCache(cached.length > 0)
        if (cached.length === 0) setError('Guides could not be loaded. Check your connection and try again.')
      } finally { if (active) setBusy(false) }
    })()
    return () => { active = false }
  }, [refresh])
  return <section aria-labelledby="mentorship-public-guides-heading" className="empty-panel" style={{ textAlign: 'left' }}>
    <div className="section-heading">
      <h2 id="mentorship-public-guides-heading">Mentorship learning resources</h2>
      <button type="button" className="btn btn-secondary" disabled={busy}
        onClick={() => setRefresh(value => value + 1)} aria-label="Refresh mentorship learning resources">
        {busy ? 'Loading…' : 'Refresh'}
      </button>
    </div>
    <p>Free learning and safety guides for every grade. Reading these does not request or book a mentor.</p>
    {busy && <p role="status">Checking published guidance…</p>}
    {offlineCache && <p className="banner banner-info" role="status">
      Showing saved public guides while the connection is unavailable.
    </p>}
    {error && <p className="banner banner-error" role="alert">{error}</p>}
    {!busy && !error && guides.length === 0 && <p>No published guides are available yet.</p>}
    {guides.length > 0 && <div style={{ display: 'grid', gap: '.75rem' }}>
      {guides.map(guide => <details key={guide.id} className="module-card"
        style={{ background: 'var(--surface)', border: '1px solid var(--line)', padding: '1rem' }}>
        <summary style={{ cursor: 'pointer' }}>
          <strong>{guide.title}</strong> <span className="muted">· {guide.category}</span>
        </summary>
        <p>{guide.description}</p>
        <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{guide.content}</p>
      </details>)}
    </div>}
  </section>
}
