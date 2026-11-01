import { describe, expect, it, vi } from 'vitest'
vi.mock('../src/lib/supabase',()=>({supabase:{}}))
import { informationErrors, informationFields, ROLE_INFORMATION } from '../src/lib/user-information'

describe('role-specific production information',()=>{
  for(const role of Object.keys(ROLE_INFORMATION)) {
    it(`requires valid answers for ${role}`,()=>{
      const fields=informationFields(role)
      const valid=Object.fromEntries(fields.map(field=>[field.key,field.options?.[0] ?? 'Sample answer']))
      expect(informationErrors(role,valid)).toEqual([])
      for(const field of fields.filter(f=>f.required)) {
        expect(informationErrors(role,{...valid,[field.key]:'   '}).length).toBeGreaterThan(0)
      }
      expect(informationErrors(role,{...valid,age_group:'not-an-age'}).length).toBeGreaterThan(0)
    })
  }
  it('never offers a privileged public registration role',()=>{
    for(const role of ['admin','super_admin','constructor','__proto__']) expect(informationFields(role)).toEqual([])
  })
  it('accepts learner age bands without treating them as verified ages',()=>{
    expect(informationFields('student')[0].options).toContain('Under 13')
    expect(informationFields('parent')[0].options).toEqual(['18 or older'])
  })
  it('rejects excessive free text and requires mentor safeguarding agreement',()=>{
    expect(informationErrors('mentor',{biography:'x'.repeat(1501)})).toContain('Professional introduction is too long.')
    expect(informationFields('mentor').find(f=>f.key==='conduct_agreement')?.required).toBe(true)
  })
})
