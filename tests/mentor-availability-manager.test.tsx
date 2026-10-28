import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import MentorAvailabilityManager from '../src/components/MentorAvailabilityManager'

const mocks = vi.hoisted(() => ({
  getUser:vi.fn(),read:vi.fn(),insert:vi.fn(),remove:vi.fn(),
}))
vi.mock('../src/lib/supabase', () => ({
  supabase:{
    auth:{getUser:mocks.getUser},
    from:()=>({
      select:()=>({eq:()=>({order:mocks.read})}),
      insert:mocks.insert,
      delete:()=>({eq:()=>({eq:()=>({select:mocks.remove})})}),
    }),
  },
}))
beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'mentor-1'}},error:null})
  mocks.read.mockResolvedValue({data:[],error:null})
  mocks.insert.mockResolvedValue({error:null})
  mocks.remove.mockResolvedValue({data:[{id:'window-1'}],error:null})
})
afterEach(cleanup)

it('pauses edits and prevents duplicate-risk windows when weekly hours cannot be loaded',async()=>{
  mocks.read.mockResolvedValueOnce({data:null,error:{message:'Cannot read private weekly hours'}})
    .mockResolvedValue({data:[],error:null})
  render(<MentorAvailabilityManager/>)
  expect((await screen.findByRole('alert')).textContent).toContain('Cannot read private weekly hours')
  expect((screen.getByRole('button',{name:'Add weekly hours'}) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByText('No weekly hours published yet.')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Retry weekly hours'}))
  await waitFor(()=>expect((screen.getByRole('button',{name:'Add weekly hours'}) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button',{name:'Add weekly hours'}))
  await waitFor(()=>expect(mocks.insert).toHaveBeenCalledTimes(1))
  expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({
    mentor_id:'mentor-1',weekday:1,start_time:'09:00',end_time:'10:00',timezone:'Africa/Addis_Ababa',
  }))
})

it('requires actual deletion of a mentor-owned slot before confirming success',async()=>{
  mocks.read.mockResolvedValue({data:[
    {id:'window-1',weekday:1,start_time:'09:00',end_time:'10:00',timezone:'Africa/Addis_Ababa'},
  ],error:null})
  mocks.remove.mockResolvedValue({data:[],error:null})
  render(<MentorAvailabilityManager/>)
  const remove = await screen.findByRole('button',{name:'Remove Monday availability'})
  fireEvent.click(remove)
  expect((await screen.findByRole('alert')).textContent).toContain('was not removed')
  expect(screen.queryByText(/Availability updated/)).toBeNull()
})

it('does not retain previous private slots if refresh loses access',async()=>{
  mocks.read.mockResolvedValueOnce({data:[
    {id:'window-1',weekday:1,start_time:'09:00',end_time:'10:00',timezone:'Africa/Addis_Ababa'},
  ],error:null}).mockResolvedValue({data:null,error:{message:'Permission denied'}})
  render(<MentorAvailabilityManager/>)
  await screen.findByRole('button',{name:'Remove Monday availability'})
  // Updating a successful slot insertion would normally trigger a refresh;
  // the direct refresh button is exercised through a failed read instead.
  fireEvent.click(screen.getByRole('button',{name:'Add weekly hours'}))
  await screen.findByRole('alert')
  expect(screen.queryByRole('button',{name:'Remove Monday availability'})).toBeNull()
  expect((screen.getByRole('button',{name:'Add weekly hours'}) as HTMLButtonElement).disabled).toBe(true)
})
