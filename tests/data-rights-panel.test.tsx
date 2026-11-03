// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  list: vi.fn(),
  insert: vi.fn(),
  rpc: vi.fn(),
  updateResult: vi.fn(),
  update: vi.fn(),
  filters: vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
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
  mocks.rpc.mockResolvedValue({ data: 'request-uuid', error: null })
  mocks.updateResult.mockResolvedValue({ data: { id: 'own-request' }, error: null })
})
afterEach(cleanup)

describe('Privacy rights access', () => {
  it('shows only the authenticated owner request and blocks a duplicate pending request', async () => {
    render(<DataRightsPanel />)
    await screen.findByRole('heading', {name:'My privacy and data rights'})
    await screen.findByRole('button',{name:'Cancel pending access request'})
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
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('request_my_data_subject_action',{p_request_type:'erasure'}))
    expect(mocks.insert).not.toHaveBeenCalled()
    expect(await screen.findByText(/Your request was recorded for authorized review/i)).toBeTruthy()
  })
  it('shows the last review update time for an active case', async () => {
    mocks.list.mockResolvedValue({data:[{...rows[0],status:'in_review',
      updated_at:'2026-11-03T12:05:00Z',response_notes:'We are continuing the review.'}],error:null})
    render(<DataRightsPanel />)
    expect(await screen.findByText(/Last review update:/)).toBeTruthy()
    expect(screen.getByText(/Message from MELA review:/)).toBeTruthy()
    expect(screen.queryByRole('button',{name:/Cancel pending access request/})).toBeNull()
  })

  it('displays the reviewer message to its owner as text and prevents cancellation once in review', async () => {
    const unsafe = '<script>not-executable()</script>'
    mocks.list.mockResolvedValue({data:[{...rows[0],status:'in_review',response_notes:unsafe}],error:null})
    const view=render(<DataRightsPanel />)
    expect(await screen.findByText(/Message from MELA review:/)).toBeTruthy()
    expect(screen.getByText(/<script>not-executable\(\)<\/script>/)).toBeTruthy()
    expect(view.container.querySelector('script')).toBeNull()
    expect(screen.queryByRole('button',{name:/Cancel pending access request/})).toBeNull()
  })

  it('shows an understandable duplicate-request error and does not promise success', async () => {
    mocks.list.mockResolvedValue({data:[],error:null})
    mocks.rpc.mockResolvedValue({data:null,error:{code:'23505',message:'duplicate key value violates unique constraint'}})
    render(<DataRightsPanel />)
    fireEvent.click(await screen.findByRole('button',{name:'Submit privacy request'}))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringMatching(/request of this type is already open/i))
    expect(screen.queryByText(/Your request was recorded for authorized review/)).toBeNull()
  })
  it('handles the preexisting server-side duplicate check even without a constraint code', async () => {
    mocks.list.mockResolvedValue({data:[],error:null})
    mocks.rpc.mockResolvedValue({data:null,error:{message:'a request of this type is already open'}})
    render(<DataRightsPanel />)
    fireEvent.click(await screen.findByRole('button',{name:'Submit privacy request'}))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringMatching(/request of this type is already open/i))
  })

  it('shows an exact owner-only case reference and copies only the opaque ID', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}})
    render(<DataRightsPanel />)
    expect(await screen.findByText(/Private request reference:/)).toBeTruthy()
    expect(screen.getByText('own-request')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Copy reference for access request'}))
    await waitFor(()=>expect(writeText).toHaveBeenCalledWith('own-request'))
    expect(await screen.findByText(/Request reference copied/)).toBeTruthy()
    expect(mocks.filters).toHaveBeenCalledWith('user_id','owner-123')
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})
  })

  it('provides an Android long-press fallback when clipboard access is unavailable', async () => {
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined})
    render(<DataRightsPanel />)
    fireEvent.click(await screen.findByRole('button',{name:'Copy reference for access request'}))
    expect(await screen.findByRole('alert')).toHaveProperty('textContent',expect.stringMatching(/Long-press the request reference/i))
    expect(screen.getByText('own-request')).toBeTruthy()
  })

})
