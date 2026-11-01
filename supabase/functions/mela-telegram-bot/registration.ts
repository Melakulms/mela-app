const roles = ['student', 'parent', 'teacher', 'company']

function validUsername(username: string) {
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)
}

/** Both Telegram deep links and manual chat commands validate the same role and username. */
export function parseRegistration(input: string): { username: string; role: string } | null {
  const parts = input.trim().split(/\s+/)
  const command = parts[0]?.toLowerCase().split('@')[0]

  if (command === '/register') {
    if (parts.length !== 3) return null
    const username = parts[1].toLowerCase()
    const role = parts[2].toLowerCase()
    return validUsername(username) && roles.includes(role) ? { username, role } : null
  }

  if (command !== '/start' || parts.length !== 2) return null
  const match = /^reg_(student|parent|teacher|company)_([A-Za-z0-9_-]{4,43})$/.exec(parts[1])
  if (!match) return null
  try {
    const username = atob(match[2].replace(/-/g, '+').replace(/_/g, '/'))
    if (!validUsername(username)) return null
    return { username, role: match[1] }
  } catch { return null }
}
