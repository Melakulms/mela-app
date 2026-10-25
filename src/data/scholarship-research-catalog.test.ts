import {describe,expect,it} from 'vitest'
import universities from './university-directory-research.json'
import programmes from './scholarship-programme-research.json'
import {safeExternalUrl} from '../lib/external-url'

describe('public university and programme research directory',()=>{
  it('includes all 200 separate institutions and 43 funding reference pages',()=>{
    expect(universities.universities).toHaveLength(200)
    expect(new Set(universities.universities.map(u=>u.id)).size).toBe(200)
    expect(universities.universities.reduce((n,u)=>n+u.funding.length,0)).toBe(43)
    expect(universities.kind).toBe('research_directory_not_scholarship_awards')
  })
  it('has HTTPS websites and no untrusted client URLs or missing country labels',()=>{
    for(const u of universities.universities) {
      expect(u.name.length).toBeGreaterThan(2)
      expect(u.country.length).toBeGreaterThan(2)
      expect(safeExternalUrl(u.website_url)).toMatch(/^https:\/\//)
      for(const f of u.funding)expect(safeExternalUrl(f.url)).toMatch(/^https:\/\//)
    }
  })
  it('keeps 12 programme sources separate from approved scholarship offers',()=>{
    expect(programmes.status).toBe('research_only_not_admin_approved')
    expect(programmes.programmes).toHaveLength(12)
    expect(new Set(programmes.programmes.map(p=>p.program_key)).size).toBe(12)
    for(const p of programmes.programmes){
      expect(p.evidence_checked_on).toBe('2026-10-24')
      expect(safeExternalUrl(p.scholarship_url)).toMatch(/^https:\/\//)
    }
  })
})
