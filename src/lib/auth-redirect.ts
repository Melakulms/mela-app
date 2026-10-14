export function authRedirectUrl(origin=window.location.origin, base=import.meta.env.BASE_URL, recovery=false) {
  const url=new URL(base,origin)
  if(recovery)url.searchParams.set('recovery','1')
  return url.toString()
}

export function hasAuthCallbackError(href: string): boolean {
  const url = new URL(href)
  const fragment = new URLSearchParams(url.hash.slice(1))
  return [url.searchParams, fragment].some(params => !!(params.get('error') || params.get('error_code')))
}

// Capture before the auth SDK consumes callback parameters.
export const initialAuthCallbackError = hasAuthCallbackError(window.location.href)

export function clearAuthCallbackError() {
  const url = new URL(window.location.href)
  for (const key of ['error', 'error_code', 'error_description', 'recovery']) url.searchParams.delete(key)
  url.hash = ''
  window.history.replaceState(null, '', url.pathname + url.search)
}
