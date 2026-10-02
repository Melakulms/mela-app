import {it,expect} from 'vitest'
import {authRedirectUrl} from '../src/lib/auth-redirect'
it('preserves the GitHub Pages project path in signup and recovery links',()=>{
 expect(authRedirectUrl('https://melakulms.github.io','/mela-app/')).toBe('https://melakulms.github.io/mela-app/')
 expect(authRedirectUrl('https://melakulms.github.io','/mela-app/',true)).toBe('https://melakulms.github.io/mela-app/?recovery=1')
})
