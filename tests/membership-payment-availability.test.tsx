// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {cleanup,fireEvent,render,screen} from '@testing-library/react'

const mocks=vi.hoisted(()=>({read:vi.fn(),rpc:vi.fn()}))
vi.mock('../src/lib/supabase',()=>({
  supabase:{
    from:(table:string)=>{
      const query:any={
        select:()=>query,eq:()=>query,limit:()=>query,
        maybeSingle:()=>Promise.resolve(mocks.read(table)),
        then:(resolve:any,reject:any)=>Promise.resolve(mocks.read(table)).then(resolve,reject),
      }
      return query
    },
    rpc:mocks.rpc,
  },
}))

import MembershipAndReferrals from '../src/components/MembershipAndReferrals'

const ok=(data:unknown)=>({data,error:null})
const catalog={
  enabled:true,
  products:[{id:'product-pro',title:'MELA Pro (30 days)',amount_minor:5000,currency:'ETB'}],
  accounts:[{id:'account-telebirr',provider:'telebirr',recipient:'test-recipient',label:'Telebirr (test fixture)'}],
}

beforeEach(()=>{
  vi.resetAllMocks()
  mocks.read.mockImplementation((table:string)=>{
    const values:Record<string,unknown>={
      subscription_plans:[{id:'plan-pro',plan_key:'normal_monthly',name:'MELA Pro',tier:'pro',price_minor:5000,currency:'ETB',billing_period_days:30}],
      user_subscriptions:[],mela_paid_memberships:[],
      referral_codes:null,registration_referrals:[],invitation_commissions:[],
    }
    return ok(values[table])
  })
  mocks.rpc.mockImplementation(async(_name:string,params:{p_action:string})=>
    ok(params.p_action==='catalog'?catalog:params.p_action==='my_orders'?[]:null))
})
afterEach(cleanup)

it('keeps the server-verified checkout catalog visible when only referral counts fail',async()=>{
  mocks.read.mockImplementation((table:string)=>{
    if(table==='registration_referrals')return {data:null,error:{message:'referral service unavailable'}}
    const values:Record<string,unknown>={
      subscription_plans:[{id:'plan-pro',plan_key:'normal_monthly',name:'MELA Pro',tier:'pro',price_minor:5000,currency:'ETB',billing_period_days:30}],
      user_subscriptions:[],mela_paid_memberships:[],
      referral_codes:null,invitation_commissions:[],
    }
    return ok(values[table])
  })
  render(<MembershipAndReferrals userId="signed-in-user"/>)
  fireEvent.click(await screen.findByRole('button',{name:'Select MELA Pro'}))
  expect(screen.getByRole('button',{name:'Create MELA Pro payment order'})).toBeTruthy()
  expect(screen.getByText(/Referral details are temporarily unavailable/)).toBeTruthy()
  expect(mocks.rpc).not.toHaveBeenCalledWith('payment_command_v1',expect.objectContaining({p_action:'create_order'}))
})

it('fails closed and explains when the payment catalog RPC fails',async()=>{
  mocks.rpc.mockImplementation(async(_name:string,params:{p_action:string})=>
    params.p_action==='catalog'?{data:null,error:{message:'checkout unavailable'}}:ok([]))
  render(<MembershipAndReferrals userId="signed-in-user"/>)
  fireEvent.click(await screen.findByRole('button',{name:'Select MELA Pro'}))
  expect(screen.getByText(/Payment status cannot be checked right now/)).toBeTruthy()
  expect(screen.getByText(/Subscription checkout is not open yet/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Create MELA Pro payment order'})).toBeNull()
})

it('fails closed if private order history cannot be checked',async()=>{
  mocks.rpc.mockImplementation(async(_name:string,params:{p_action:string})=>
    params.p_action==='my_orders'?{data:null,error:{message:'orders unavailable'}}:ok(catalog))
  render(<MembershipAndReferrals userId="signed-in-user"/>)
  fireEvent.click(await screen.findByRole('button',{name:'Select MELA Pro'}))
  expect(screen.getByText(/Payment status cannot be checked right now/)).toBeTruthy()
  expect(screen.queryByRole('button',{name:'Create MELA Pro payment order'})).toBeNull()
})
