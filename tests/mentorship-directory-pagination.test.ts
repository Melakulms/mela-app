import { beforeEach,describe,expect,it,vi } from 'vitest'
import { fetchVerifiedMentorsPage } from '../src/lib/mentorship'

const mocks=vi.hoisted(()=>({
  page:vi.fn(),profiles:vi.fn(),slots:vi.fn(),
}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    from:(table:string)=>{
      if(table==='mentor_profiles')return {
        select:()=>({eq:()=>({eq:()=>({order:()=>({range:mocks.page})})})}),
      }
      if(table==='profiles')return {select:()=>({in:mocks.profiles})}
      if(table==='mentor_availability')return {
        select:()=>({in:()=>({eq:()=>({order:mocks.slots})})}),
      }
      throw new Error('Unexpected table '+table)
    },
  },
}))
beforeEach(()=>{
  vi.clearAllMocks()
  mocks.profiles.mockResolvedValue({data:[
    {id:'mentor-1',full_name:'Educator One'},
    {id:'mentor-2',full_name:'Educator Two'},
  ],error:null})
  mocks.slots.mockResolvedValue({data:[],error:null})
})
describe('paged verified mentor directory',()=>{
  it('loads a bounded page and uses a one-row sentinel to signal more profiles',async()=>{
    mocks.page.mockResolvedValue({data:[
      {user_id:'mentor-1',headline:'Science educator',rating_average:null,rating_count:0,expertise:['Science'],languages:['Amharic']},
      {user_id:'mentor-2',headline:'Career educator',rating_average:4.5,rating_count:2,expertise:['Career'],languages:['English']},
      {user_id:'mentor-3',headline:'More results sentinel',rating_average:0,rating_count:0,expertise:[],languages:[]},
    ],error:null})
    const result=await fetchVerifiedMentorsPage(0,2)
    expect(mocks.page).toHaveBeenCalledWith(0,2)
    expect(result.hasMore).toBe(true)
    expect(result.mentors.map(m=>m.user_id)).toEqual(['mentor-1','mentor-2'])
    expect(result.mentors[0].rating_average).toBe(0)
    expect(result.mentors[1].rating_average).toBe(4.5)
  })
  it('supports later pages without a global results limit',async()=>{
    mocks.page.mockResolvedValue({data:[
      {user_id:'mentor-2',headline:'Career',rating_average:4,rating_count:1,expertise:[],languages:[]},
    ],error:null})
    const result=await fetchVerifiedMentorsPage(5000,50)
    expect(mocks.page).toHaveBeenCalledWith(5000,5050)
    expect(result.hasMore).toBe(false)
    expect(result.mentors).toHaveLength(1)
  })
  it('rejects invalid paging parameters before any query',async()=>{
    await expect(fetchVerifiedMentorsPage(-1)).rejects.toThrow(/Invalid mentor directory/)
    await expect(fetchVerifiedMentorsPage(0,101)).rejects.toThrow(/Invalid mentor directory/)
    expect(mocks.page).not.toHaveBeenCalled()
  })
})
