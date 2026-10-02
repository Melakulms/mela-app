import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'
import JoinClassroom from '../src/components/JoinClassroom'
const mock=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({supabase:mock}))
afterEach(()=>{cleanup();vi.resetAllMocks()})
it('preserves the join code after failure and confirms only a successful join',async()=>{
 mock.rpc.mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({error:null})
 render(<JoinClassroom/> )
 fireEvent.change(screen.getByLabelText('Classroom code'),{target:{value:'ABC123'}})
 fireEvent.click(screen.getByRole('button',{name:'Join classroom'}))
 await screen.findByRole('alert')
 expect((screen.getByLabelText('Classroom code') as HTMLInputElement).value).toBe('ABC123')
 expect(screen.queryByRole('status')).toBeNull()
 fireEvent.click(screen.getByRole('button',{name:'Join classroom'}))
 await screen.findByRole('status')
 expect(mock.rpc).toHaveBeenLastCalledWith('join_educator_classroom',{p_join_code:'ABC123'})
})
