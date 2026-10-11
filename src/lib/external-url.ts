export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    // External resources must not send learners to local devices or credentials.
    if (!host.includes('.') || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || host.startsWith('[')) return null
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && (!url.port || ['80', '443'].includes(url.port)) ? url.href : null
  } catch { return null }
}
