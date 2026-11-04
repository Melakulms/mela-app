// @vitest-environment node
import {readFileSync} from 'node:fs'
import {join} from 'node:path'
import {describe,expect,it} from 'vitest'

const page=readFileSync(join(process.cwd(),'public/legal/mela-protection-plan.html'),'utf8')
const record=readFileSync(join(process.cwd(),'docs/privacy/20-point-production-register-2026-11-04.md'),'utf8')
describe('privacy 20-point evidence is not presented as production certification',()=>{
  it('shows all twenty independently labeled controls with evidence-based statuses',()=>{
    const controls=[...page.matchAll(/<strong>(\d+)\. [^<]+<\/strong><span class="control-state">Status: ([^<]+)<\/span>/g)]
    expect(controls.map(m=>Number(m[1]))).toEqual(Array.from({length:20},(_,i)=>i+1))
    expect(controls.filter(m=>m[2]==='Partial')).toHaveLength(10)
    expect(controls.filter(m=>m[2]==='Unverified')).toHaveLength(9)
    expect(controls.filter(m=>m[2]==='Present in code, not certified')).toHaveLength(1)
  })
  it('keeps public policy status and internal release blockers explicit',()=>{
    expect(page).toContain('not a final Privacy Notice')
    expect(page).toContain('0 of 20 independently certified complete')
    expect(page).toContain('No control has been certified complete')
    expect(record).toContain('eu-west-1')
    expect(record).toContain('NOT CLEARED')
    expect(record).toContain('do not infer collection status')
  })
})
