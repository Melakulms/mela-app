/**
 * Subsection URLs are navigation hints, never authorization. Every privileged
 * action still enforces server-side role, adult/guardian and MFA checks.
 */
export const MENTORSHIP_SECTION_PARAM = 'mentorship_section'
export const MENTORSHIP_SECTION_COUNT = 16

export function readMentorshipSection(url: URL): number | null {
  if (url.searchParams.get('view') !== 'mentorship') return null
  const raw = url.searchParams.get(MENTORSHIP_SECTION_PARAM)
  // Refuse decimals, signs, exponent notation, prefixes and out-of-range IDs.
  if (!raw || !/^(?:[1-9]|1[0-6])$/.test(raw)) return null
  return Number(raw)
}

export function withMentorshipSection(url: URL, next: number | null): URL {
  const target = new URL(url.toString())
  if (next === null) target.searchParams.delete(MENTORSHIP_SECTION_PARAM)
  else if (Number.isInteger(next) && next >= 1 && next <= MENTORSHIP_SECTION_COUNT) {
    target.searchParams.set(MENTORSHIP_SECTION_PARAM, String(next))
  } else throw new Error('Unknown mentorship section.')
  return target
}
