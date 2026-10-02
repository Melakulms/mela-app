export function authRedirectUrl(origin=window.location.origin, base=import.meta.env.BASE_URL, recovery=false) {
  const url=new URL(base,origin)
  if(recovery)url.searchParams.set('recovery','1')
  return url.toString()
}
