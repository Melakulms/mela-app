// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  list: vi.fn(),
  insert: vi.fn(),
  updateResult: vi.fn(),
  update: vi.fn(),
  filters: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    from: (table: string) => {
      if (table !== 'data_subject_requests') throw new Error('Unexpected database table')
      return {
        select: () => ({
          eq: (column: string, value: string) => { mocks.filters(column, value); return {
            order: () => ({limit: () => mocks.list()}),
          } },
        }),
        insert: (payload: unknown) => mocks.insert(payload),
        update: (payload: unknown) => {
          mocks.update(payload)
          const query = {
            eq(column: string, value: string) { mocks.filters(column, value); return query },
            select() { return {maybeSingle: () => mocks.updateResult()} },
          }
          return query
        },
      }
    },
  },
}))
import DataRightsPanel from '../src/components/DataRightsPanel'
const rows = [{ id: 'own-request', request_type: 'access', status: 'pending', requested_at: '2026-11-03T01:00:00Z' }]
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: {id:'owner-123'} }, error: null })
  mocks.list.mockResolvedValue({ data: rows, error: null })
  mocks.insert.mockResolvedValue({ error: null })
  mocks.updateResult.mockResolvedValue({ data: { id: 'own-request' }, error: null })
})
afterEach(cleanup)

describe('Privacy rights access', () => {
  it('shows only the authenticated owner request and blocks a duplicate pending request', async () => {
    render(<DataRightsPanel />)
    await screen.findByRole('heading', {name:'My privacy and data rights'})
    await screen.findByText(/pending/i)
    expect(mocks.filters).toHaveBeenCalledWith('user_id', 'owner-123')
    expect(screen.getByRole('button', {name: 'Submit privacy request'}).hasAttribute('disabled')).toBe(true)
  })
  it('requires a second confirmation to cancel and only changes pending owner requests', async () => {
    render(<DataRightsPanel />)
    const begin = await screen.findByRole('button', { name: 'Cancel pending access request' })
    fireEvent.click(begin)
    expect(mocks.update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name:'Confirm cancellation'}))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({status:'cancelled'}))
    expect(mocks.filters).toHaveBeenCalledWith('id','own-request')
    expect(mocks.filters).toHaveBeenCalledWith('user_id','owner-123')
    expect(mocks.filters).toHaveBeenCalledWith('status','pending')
    expect(await screen.findByText(/pending request was cancelled/i)).toBeTruthy()
  })
  it('does not claim cancellation if the backend did not update a row', async () => {
    mocks.updateResult.mockResolvedValue({data:null,error:null})
    render(<DataRightsPanel />)
    fireEvent.click(await screen.findByRole('button', {name:'Cancel pending access request'}))
    fireEvent.click(screen.getByRole('button', {name:'Confirm cancellation'}))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringMatching(/no longer pending/i))
  })
  it('submits owner-scoped new privacy requests without promising automatic deletion', async () => {
    mocks.list.mockResolvedValue({data:[],error:null})
    render(<DataRightsPanel />)
    fireEvent.change(await screen.findByLabelText('What would you like to request?'), {target:{value:'erasure'}})
    fireEvent.click(screen.getByRole('button',{name:'Submit privacy request'}))
    await waitFor(() => expect(mocks.insert).toHaveBeenCalledWith({user_id:'owner-123',request_type:'erasure',status:'pending'}))
    expect(await screen.findByText(/does not automatically delete/i)).toBeTruthy()
  })
})
