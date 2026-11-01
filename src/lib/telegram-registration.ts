const roles = ['student', 'parent', 'teacher', 'company']

export function telegramRegistrationLink(username: string, role: string): string | null {
  const normalized = username.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(normalized) || !roles.includes(role)) return null
  const encoded = btoa(normalized).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `https://t.me/Mela_edu_bot?start=reg_${role}_${encoded}`
}
