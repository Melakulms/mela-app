import { expect, it, vi } from 'vitest'
import { submitRound } from '../src/lib/arena'
const rpc = vi.hoisted(() => vi.fn())
vi.mock('../src/lib/supabase', () => ({ supabase: { rpc } }))
it('sends the JSON string choice expected by the private assessment answer key', async () => {
  rpc.mockResolvedValue({ data: { score: 10 }, error: null })
  expect(await submitRound('round-id', 'A')).toEqual({ score: 10 })
  expect(rpc).toHaveBeenCalledWith('submit_arena_round', { p_round_id: 'round-id', p_response: 'A', p_attachment_url: null })
})
