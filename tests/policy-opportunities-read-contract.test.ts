import {readFileSync} from 'node:fs'
import {describe,expect,it} from 'vitest'

const migration=readFileSync('supabase/staging-only/20261105_mela_opportunities_anon_public_read.sql','utf8')
const rollback=readFileSync('supabase/staging-only/20261105_mela_opportunities_anon_public_read_rollback.sql','utf8')
const regression=readFileSync('tests/sql/20261105_opportunities_anon_read_regression.sql','utf8')

describe('staging-only public opportunity access repair',()=>{
  it('preserves anon/public boundaries without granting employer-table access',()=>{
    expect(migration).toContain('to anon')
    expect(migration).toContain('to authenticated')
    expect(migration).toContain("moderation_status = 'approved'")
    expect(migration).toContain('deadline >= current_date')
    expect(migration).toContain("e.verification_status = 'verified'")
    expect(migration).toContain('security definer')
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain('revoke all on function')
    expect(migration).not.toMatch(/grant\s+select\s+on\s+(?:public\.)?employers\s+to\s+anon/i)
  })
  it('includes an explicit rollback and a real database role regression script',()=>{
    expect(rollback).toContain('drop function if exists private.mela_public_opportunity_employer_verified(uuid)')
    expect(rollback).toContain('create policy "Opportunities readable"')
    expect(regression).toContain('set local role anon')
    expect(regression).toContain('set local role authenticated')
    expect(regression).toContain('rollback;')
  })
})
