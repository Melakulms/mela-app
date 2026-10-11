import {expect,it} from 'vitest'
import {safeExternalUrl} from '../src/lib/external-url'
it('accepts official web links and rejects executable or credential-bearing links',()=>{
 expect(safeExternalUrl('https://example.edu/apply')).toBe('https://example.edu/apply')
 for(const value of ['javascript:alert(1)','data:text/html,test','https://user:secret@example.edu','//example.edu',null]) expect(safeExternalUrl(value)).toBeNull()
})
it('rejects local device links, nonstandard ports and control characters',()=>{
 for(const value of ['http://127.0.0.1/','http://2130706433/','http://0x7f000001/','http://localhost/','http://router.local/','http://[::1]/','https://example.edu:8080/','https://exam\nple.edu/']) expect(safeExternalUrl(value)).toBeNull()
 expect(safeExternalUrl('https://example.edu:443/path')).toBe('https://example.edu/path')
})
