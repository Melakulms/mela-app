import { useEffect, useState } from 'react'

/**
 * Navigate from a module's list to one focused section (or nested subsection).
 * The selection lives in the URL so the Android/browser Back button restores
 * the previous screen instead of leaving the whole module.
 *
 * This is presentation-only navigation. Callers must still validate the
 * selected ID against accessible server-fetched records.
 */
export function useSectionDrilldown(param: 'section' | 'subsection') {
  const read = () => new URLSearchParams(window.location.search).get(param)
  const [selected, setSelected] = useState<string | null>(read)

  useEffect(() => {
    const restore = () => setSelected(read())
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [param])

  const open = (id: string) => {
    if (!id || id === selected) return
    const url = new URL(window.location.href)
    url.searchParams.set(param, id)
    if (param === 'section') url.searchParams.delete('subsection')
    window.history.pushState({ ...(window.history.state ?? {}), melaDrilldown: param }, '', url)
    setSelected(id)
  }

  const close = () => {
    if (window.history.state?.melaDrilldown === param) {
      // The current entry was created by this drilldown; return to its parent.
      window.history.back()
    } else {
      // Opening a shared deep link must not leave MELA or go to an unrelated site.
      const url = new URL(window.location.href)
      url.searchParams.delete(param)
      if (param === 'section') url.searchParams.delete('subsection')
      window.history.replaceState(null, '', url)
    }
    setSelected(null)
  }

  return [selected, open, close] as const
}
