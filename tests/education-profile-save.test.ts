import { describe, expect, it, vi } from 'vitest'

// This suite uses a fake Supabase client; it never requests real account data.
vi.mock('../src/lib/supabase', () => ({ supabase: {} }))
import { explainEducationSaveError } from '../src/lib/education-profile-save'

describe('education profile save troubleshooting', () => {
  it('shows actionable row-level permission errors rather than a generic message', () => {
    const message = explainEducationSaveError(
      { code: '42501', message: 'new row violates row-level security policy' },
      'saving your subjects',
    )
    expect(message).toContain('saving your subjects')
    expect(message).toContain('database denied this change')
    expect(message).toContain('42501')
    expect(message).toContain('row-level security')
  })

  it('explains missing Supabase RPC migrations', () => {
    expect(explainEducationSaveError(
      { code: 'PGRST202', message: 'Could not find the function' },
      'completing profile',
    )).toMatch(/database function is unavailable/)
  })

  it('preserves server validation errors even when thrown as plain objects', () => {
    expect(explainEducationSaveError(
      {code:'P0001',message:'verified active account required'},
      'completing profile',
    )).toContain('account must be active and verified')
  })

  it('redacts credentials from any unexpected backend message', () => {
    const message = explainEducationSaveError(
      {code:'E42',message:'Bearer abc.def.xyz access_token=verysecret'},
      'loading account',
    )
    expect(message).not.toContain('abc.def.xyz')
    expect(message).not.toContain('verysecret')
    expect(message).toContain('E42')
  })

  it('explains missing messages without exposing request objects', () => {
    const message = explainEducationSaveError({status:400},'verifying saved profile')
    expect(message).toContain('did not return a readable error')
  })
})
