export function parseRegistration(input: string): { username: string; role: string } | null {
  const parts = input.trim().split(/\s+/)
  if (parts[0].toLowerCase().split('@')[0] !== '/start' || parts.length !== 2) return null
  const match = /^reg_(student|parent|teacher|company)_([A-Za-z0-9_-]{4,43})$/.exec(parts[1])
  if (!match) return null
  try {
    const username = atob(match[2].replace(/-/g, '+').replace(/_/g, '/'))
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return null
    return { username, role: match[1] }
  } catch { return null }
}
