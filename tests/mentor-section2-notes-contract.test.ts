import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decideMfaGate, mapMfaError } from '../src/lib/mentor-mfa'
import { NOTES_MAX, publishNotes, saveNotesDraft } from '../src/lib/mentorship-notes'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }))

beforeEach(() => {
  vi.resetAllMocks()
  mocks.rpc.mockResolvedValue({ data: { notes_revision: 1 }, error: null })
})

describe('Mentorship Section 2 publication contract', () => {
  it('requires the exact editor body in the atomic publish RPC', async () => {
    await expect(publishNotes('session-1', '  Latest visible text  ', 0)).resolves.toBe(1)
    expect(mocks.rpc).toHaveBeenCalledWith('publish_mentorship_session_notes', {
      p_session_id: 'session-1', p_body: 'Latest visible text', p_expected_revision: 0,
    })
  })
  it('never sends empty content to the publishing RPC', async () => {
    await expect(publishNotes('session-1', '  ', 0)).rejects.toThrow('1 to 2000')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('never sends overlong content to the publishing RPC', async () => {
    await expect(publishNotes('session-1', 'x'.repeat(NOTES_MAX + 1), 0)).rejects.toThrow('1 to 2000')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('does not falsely report publication when server rejects an outdated revision', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'published notes changed: reload before publishing' } })
    await expect(publishNotes('session-1', 'Text', 3)).rejects.toThrow('reload')
  })
  it('saving a private draft never calls publish', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { saved: true }, error: null })
    await saveNotesDraft('session-1', 'private notes')
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('save_mentorship_notes_draft', {
      p_session_id: 'session-1', p_body: 'private notes',
    })
  })
})

describe('MFA gate decisions', () => {
  it('blocks aal1 even with an enrolled factor', () => {
    expect(decideMfaGate({
      currentLevel: 'aal1', verifiedFactorCount: 1, unverifiedFactorCount: 0,
    })).toBe('verify')
  })
  it('allows already-verified aal2 and handles unfinished enrollment', () => {
    expect(decideMfaGate({
      currentLevel: 'aal2', verifiedFactorCount: 1, unverifiedFactorCount: 0,
    })).toBe('ready')
    expect(decideMfaGate({
      currentLevel: 'aal1', verifiedFactorCount: 0, unverifiedFactorCount: 1,
    })).toBe('resume_setup')
  })
  it('does not reveal internal SQL or auth stack traces to the user', () => {
    expect(mapMfaError(new Error('XX000 stack trace private schema'))).toMatch(/contact MELA support/i)
  })
})
