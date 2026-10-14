import {afterEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react'
const mock=vi.hoisted(()=>({
 upload:vi.fn().mockResolvedValue({data:{path:'private'},error:null}),
 insert:vi.fn().mockResolvedValue({data:null,error:null}),
 getUser:vi.fn().mockResolvedValue({data:{user:{id:'11111111-1111-4111-8111-111111111111'}},error:null}),
 signed:vi.fn().mockResolvedValue({data:{signedUrl:'https://private.example.invalid/short'},error:null}),
}))
vi.mock('../src/lib/supabase',()=>({
 supabase:{
  auth:{getUser:mock.getUser},
  from:()=>({select:()=>({eq:()=>({order:async()=>({data:[],error:null})})}),insert:mock.insert}),
  storage:{from:()=>({upload:mock.upload,createSignedUrl:mock.signed})},
 },
}))
import TeacherCredentialUpload from '../src/components/TeacherCredentialUpload'
afterEach(()=>{cleanup();vi.clearAllMocks()})

it('submits a private teacher PDF without granting question review access',async()=>{
 render(<TeacherCredentialUpload/>)
 await screen.findByText('No documents submitted yet.')
 const picker=screen.getByLabelText('Choose certificate (PDF, JPG or PNG)') as HTMLInputElement
 const file=new File(['fixture-pdf'],'qualification.pdf',{type:'application/pdf'})
 fireEvent.change(picker,{target:{files:[file]}})
 fireEvent.click(screen.getByRole('button',{name:'Submit qualification for verification'}))
 await waitFor(()=>expect(mock.upload).toHaveBeenCalledTimes(1))
 const [path,uploaded,options]=mock.upload.mock.calls[0]
 expect(path).toMatch(/^11111111-1111-4111-8111-111111111111\/[0-9a-f-]{36}\.pdf$/)
 expect(uploaded).toBe(file)
 expect(options).toEqual({contentType:'application/pdf',upsert:false})
 await waitFor(()=>expect(mock.insert).toHaveBeenCalledWith(expect.objectContaining({
  teacher_id:'11111111-1111-4111-8111-111111111111',document_kind:'degree',
  storage_path:path,original_name:'qualification.pdf',
 })))
 expect(await screen.findByText(/qualification was submitted privately/)).toBeTruthy()
 expect(screen.getByText(/until approved/)).toBeTruthy()
})

it('rejects unsupported file type before uploading',async()=>{
 render(<TeacherCredentialUpload/>)
 await screen.findByText('No documents submitted yet.')
 fireEvent.change(screen.getByLabelText('Choose certificate (PDF, JPG or PNG)'),{
  target:{files:[new File(['malware'],'credential.exe',{type:'application/octet-stream'})]},
 })
 fireEvent.click(screen.getByRole('button',{name:'Submit qualification for verification'}))
 expect(await screen.findByRole('alert')).toHaveProperty('textContent','Choose a PDF, JPG or PNG certificate.')
 expect(mock.upload).not.toHaveBeenCalled()
})
