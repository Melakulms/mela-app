import {expect,it} from 'vitest'
import {safeExternalUrl} from '../src/lib/external-url'
it('accepts official web links and rejects executable or credential-bearing links',()=>{
 expect(safeExternalUrl('https://example.edu/apply')).toBe('https://example.edu/apply')
 for(const value of ['javascript:alert(1)','data:text/html,test','https://user:secret@example.edu','//example.edu',null]) expect(safeExternalUrl(value)).toBeNull()
})
