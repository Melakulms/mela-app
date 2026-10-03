import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
import TeacherClassrooms from '../src/components/TeacherClassrooms'
const mocks=vi.hoisted(()=>({getUser:vi.fn(),rpc:vi.fn(),rooms:vi.fn(),educator:vi.fn(),stages:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:{auth:{getUser:mocks.getUser},rpc:mocks.rpc,from:(table:string)=>{
 const query:any={select:()=>query,eq:()=>query,order:()=>table==='educator_classrooms'?mocks.rooms():mocks.stages(),maybeSingle:mocks.educator};return query
}}}))
const room={id:'room',title:'Mathematics',stage_key:'school_9_10',subject:'Math',join_code:'ABC123',active:true}
beforeEach(()=>{vi.resetAllMocks();mocks.getUser.mockResolvedValue({data:{user:{id:'teacher'}}});mocks.rooms.mockResolvedValue({data:[room]});mocks.educator.mockResolvedValue({data:{verified:true,active:true}});mocks.stages.mockResolvedValue({data:[{stage_key:'school_9_10',title:'Grades 9–10'}]})})
afterEach(cleanup)
it('does not present a loading failure as an empty classroom list or an unverified teacher',async()=>{
 mocks.rooms.mockRejectedValueOnce(new Error('Connection lost'))
 render(<TeacherClassrooms onChanged={vi.fn()}/>);await screen.findByRole('alert')
 expect(screen.queryByText('No classrooms yet.')).toBeNull();expect(screen.queryByText(/school-linked educator profile/)).toBeNull()
 fireEvent.click(screen.getByText('Refresh classrooms'));await screen.findByLabelText('Classroom title');expect(screen.getByRole('option',{name:'Grades 9–10'})).toBeTruthy()
})
it('removes stale roster and creation controls when refreshed permissions cannot load',async()=>{
 mocks.rpc.mockResolvedValue({data:{classroom:room,learners:[{id:'learner',full_name:'Test learner',grade_level:10,mastery:{overall_score:20,evidence_count:1}}]}})
 render(<TeacherClassrooms onChanged={vi.fn()}/>);fireEvent.click(await screen.findByText('View learners'));await screen.findByText('Test learner')
 mocks.educator.mockResolvedValue({data:null,error:{message:'Permission unavailable'}})
 fireEvent.click(screen.getByText('Refresh classrooms'));await screen.findByRole('alert')
 expect(screen.queryByText('Test learner')).toBeNull();expect(screen.queryByLabelText('Classroom title')).toBeNull()
})
it('confirms a successful create even if the following list refresh fails',async()=>{
 mocks.rpc.mockResolvedValue({error:null})
 const changed=vi.fn();render(<TeacherClassrooms onChanged={changed}/>);await screen.findByLabelText('Classroom title')
 fireEvent.change(screen.getByLabelText('Classroom title'),{target:{value:' Science '}});fireEvent.change(screen.getByLabelText('Education stage'),{target:{value:'school_9_10'}})
 mocks.rooms.mockRejectedValue(new Error('Refresh failed'));fireEvent.click(screen.getByText('Create classroom'))
 await screen.findByText('Classroom created. Share the join code with your students.');await screen.findByRole('alert')
 expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('create_my_classroom',{p_title:'Science',p_stage_key:'school_9_10',p_subject:null});await waitFor(()=>expect(changed).toHaveBeenCalledOnce())
})
