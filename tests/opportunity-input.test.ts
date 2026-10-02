import {describe,it,expect} from 'vitest'
import {opportunityFields} from '../src/lib/opportunity-input'
const input={title:' Developer ',opportunityType:'jobs',location:'Addis Ababa',deadline:'2026-11-01',summary:'',description:'Develop learning tools',sectorCategory:'Technology',employmentType:'Full time',reward:'ETB 20000 / month'}
describe('Opportunity submission contract',()=>{
 it('includes mandatory fields and submits for moderation',()=>{
  expect(opportunityFields(input,'2026-10-02')).toMatchObject({title:'Developer',description:input.description,sector_category:'Technology',employment_type_label:'Full time',stipend_or_reward:input.reward,status:'pending_review',moderation_status:'pending_review'})
 })
 it('rejects missing fields and invalid deadlines or categories',()=>{
  expect(()=>opportunityFields({...input,description:''})).toThrow()
  expect(()=>opportunityFields({...input,deadline:'2020-01-01'})).toThrow()
  expect(()=>opportunityFields({...input,deadline:'2026-02-30'},'2026-01-01')).toThrow()
  expect(()=>opportunityFields({...input,sectorCategory:'invalid'})).toThrow()
 })
})
