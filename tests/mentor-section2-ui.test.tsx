import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ get: vi.fn(), publish: vi.fn(), save: vi.fn() }))
vi.mock('../src/lib/mentorship-notes', () => ({
  NOTES_MAX: 2000,
  getNotesDraft: mocks.get,
  publishNotes: mocks.publish,
  saveNotesDraft: mocks.save,
}))
vi.mock('../src/components/MentorMfaGate', () => ({
  default: ({ onReady }: { onReady: () => void }) => <button onClick={onReady}>Complete MFA</button>,
}))
import MentorNotesEditor from '../src/components/MentorNotesEditor'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.get.mockResolvedValue({ body: 'Last saved draft', publishedRevision: 4, updatedAt: null })
  mocks.publish.mockResolvedValue(5)
  mocks.save.mockResolvedValue(undefined)
})
afterEach(cleanup)

it('does not request private notes before MFA is completed', async () => {
  render(<MentorNotesEditor sessionId="s1" onClose={vi.fn()} />)
  expect(mocks.get).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Complete MFA' }))
  await screen.findByDisplayValue('Last saved draft')
  expect(mocks.get).toHaveBeenCalledWith('s1')
})

it('publishes the text the mentor is actually confirming, not the last saved draft', async () => {
  render(<MentorNotesEditor sessionId="s1" onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Complete MFA' }))
  const editor = await screen.findByDisplayValue('Last saved draft')
  fireEvent.change(editor, { target: { value: 'Current visible version' } })
  fireEvent.click(screen.getByRole('button', { name: 'Publish notes…' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm publish' }))
  await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith('s1', 'Current visible version', 4))
  expect(mocks.save).not.toHaveBeenCalled()
})

it('discards private editor state on a user authentication boundary', async () => {
  const close = vi.fn()
  render(<MentorNotesEditor sessionId="s1" onClose={close} />)
  fireEvent.click(screen.getByRole('button', { name: 'Complete MFA' }))
  await screen.findByDisplayValue('Last saved draft')
  fireEvent(window, new Event('mela:session-boundary'))
  expect(close).toHaveBeenCalled()
  expect(screen.queryByDisplayValue('Last saved draft')).toBeNull()
})
