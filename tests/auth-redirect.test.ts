import {it,expect} from 'vitest'
import {authRedirectUrl, hasAuthCallbackError, clearAuthCallbackError} from '../src/lib/auth-redirect'
it('preserves the GitHub Pages project path in signup and recovery links',()=>{
 expect(authRedirectUrl('https://melakulms.github.io','/mela-app/')).toBe('https://melakulms.github.io/mela-app/')
 expect(authRedirectUrl('https://melakulms.github.io','/mela-app/',true)).toBe('https://melakulms.github.io/mela-app/?recovery=1')
})

it('detects failed email callbacks without confusing successful tokens', () => {
 expect(hasAuthCallbackError('https://example.com/#error=access_denied&error_code=otp_expired')).toBe(true)
 expect(hasAuthCallbackError('https://example.com/?error_code=otp_expired')).toBe(true)
 expect(hasAuthCallbackError('https://example.com/#access_token=valid&type=recovery')).toBe(false)
})
it('removes failed callback data while preserving the application path', () => {
 window.history.replaceState(null, '', '/mela-app/?recovery=1&lang=en#error=access_denied')
 clearAuthCallbackError()
 expect(window.location.pathname + window.location.search + window.location.hash).toBe('/mela-app/?lang=en')
})
