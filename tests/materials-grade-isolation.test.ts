import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLearningLibrary } from '../src/lib/materials'

const mocks=vi.hoisted(()=>({
  getUser:vi.fn(),rpc:vi.fn(),profile:vi.fn(),student:vi.fn(),catalog:vi.fn(),
}))
vi.mock('../src/lib/supabase',()=>({supabase:{
  auth:{getUser:mocks.getUser},
  rpc:mocks.rpc,
  from:(table:string)=>{
    const query:any={
      select:()=>query,
      eq:()=>query,
      maybeSingle:()=>table==='student_profiles'?mocks.student():mocks.profile(),
      then:(resolve:any,reject:any)=>mocks.catalog().then(resolve,reject),
    }
    return query
  },
}}))
beforeEach(()=>{
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({data:{user:{id:'grade1-user'}},error:null})
  mocks.profile.mockResolvedValue({data:{education_stage_key:'school_1_6',grade_level:1},error:null})
  mocks.student.mockResolvedValue({data:{subjects:['mathematics']},error:null})
  mocks.catalog.mockResolvedValue({data:[
    {stage_key:'school_1_6',track_key:'common',subject_key:'mathematics',optional:false},
  ],error:null})
  mocks.rpc.mockResolvedValue({data:{products:[],programs:[
    {program_key:'g1_math',subject_key:'mathematics',subject_title:'Mathematics',track_key:'common',grade_level:1,units:[]},
    {program_key:'g1_biology',subject_key:'biology',subject_title:'Biology',track_key:'common',grade_level:1,units:[]},
    {program_key:'g2_math',subject_key:'mathematics',subject_title:'Mathematics',track_key:'common',grade_level:2,units:[]},
  ]},error:null})
})
describe('school materials use actual registered curriculum',()=>{
  it('keeps only saved Grade 1 Mathematics, not Biology or a Grade 2 program',async()=>{
    const lib=await fetchLearningLibrary('school_1_6',1)
    expect(lib.programs.map(p=>p.program_key)).toEqual(['g1_math'])
    expect(mocks.rpc).toHaveBeenCalledWith('get_mela_learning_library',{
      p_stage_key:'school_1_6',p_grade_level:1,p_track_key:null,
    })
  })
  it('rejects a caller-selected grade different from saved grade',async()=>{
    await expect(fetchLearningLibrary('school_1_6',2)).rejects.toThrow(/saved grade/)
  })
  it('rejects missing student subject enrollment',async()=>{
    mocks.student.mockResolvedValue({data:{subjects:[]},error:null})
    await expect(fetchLearningLibrary('school_1_6',1)).rejects.toThrow(/Save your curriculum subjects/)
  })
})
