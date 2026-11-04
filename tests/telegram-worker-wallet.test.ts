// @vitest-environment node
import {describe,expect,it,vi} from 'vitest'
import {readFileSync} from 'node:fs'
import {workerReply} from '../supabase/functions/mela-telegram-bot/worker'

const sql=readFileSync(new URL('../supabase/migrations/20261104204000_telegram_worker_wallet_readonly.sql',import.meta.url),'utf8')

describe('Telegram worker-wallet commands',()=>{
 it('pairs only through a 48-char one-use wallet token and its private Telegram chat',async()=>{
   const rpc=vi.fn(async()=>({linked:true}))
   const token='a'.repeat(48)
   const result=await workerReply('/start work_'+token,'123456789',123,rpc)
   expect(result).toMatch(/securely linked/)
   expect(rpc).toHaveBeenCalledWith('link',{chat_id:'123456789',token,update_id:123})
 })
 it('does not interfere with registration or existing payment deep links',async()=>{
   const rpc=vi.fn()
   expect(await workerReply('/start pay_'+'b'.repeat(48),'123456789',1,rpc)).toBeNull()
   expect(await workerReply('/register user1 student','123456789',2,rpc)).toBeNull()
   expect(rpc).not.toHaveBeenCalled()
 })
 it('never shows an unlinked chat any balance or payout',async()=>{
   const rpc=vi.fn(async()=>({linked:false,available:500}))
   const result=await workerReply('/earnings','123456789',44,rpc)
   expect(result).toContain('Connect your Telegram chat')
   expect(result).not.toContain('500')
 })
 it('shows only recorded amounts and clearly distinguishes them from bank funds',async()=>{
   const rpc=vi.fn(async()=>({linked:true,available:10,pending:20.5,paid:30,payouts_enabled:false}))
   const result=await workerReply('/work','123456789',45,rpc)
   expect(result).toContain('10.00 ETB')
   expect(result).toContain('20.50 ETB')
   expect(result).toContain('Recorded paid: 30.00 ETB')
   expect(result).toContain('not bank funds')
   expect(result).toContain('disabled')
 })
 it('does not allow a Telegram withdrawal while real payouts are disabled',async()=>{
   const rpc=vi.fn(async()=>({linked:true,payouts_enabled:false}))
   const result=await workerReply('/withdraw','123456789',46,rpc)
   expect(result).toContain('disabled')
   expect(result).toContain('No money can be sent')
   expect(rpc).toHaveBeenCalledWith('status',{chat_id:'123456789'})
 })
 it('shows a limited payout status history and no bank credentials',async()=>{
   const rpc=vi.fn(async()=>({linked:true,payouts_enabled:false,recent_payouts:[{amount_etb:42.5,status:'pending',date:'2026-11-04'}]}))
   const result=await workerReply('/payouts','123456789',47,rpc)
   expect(result).toContain('42.50 ETB')
   expect(result).toContain('pending')
   expect(result).toContain('not independent bank')
 })
 it('lets a user unlink a private chat without changing money',async()=>{
   const rpc=vi.fn(async()=>({unlinked:true}))
   const result=await workerReply('/unlink','123456789',48,rpc)
   expect(result).toContain('financial records are unchanged')
   expect(rpc).toHaveBeenCalledWith('unlink',{chat_id:'123456789'})
 })
 it('keeps bot authority to service role only and wallet pairing to authenticated user',()=>{
   expect(sql).toContain('create or replace function public.mela_worker_telegram_link_v1()')
   expect(sql).toContain("auth.uid()")
   expect(sql).toContain("grant execute on function public.mela_worker_telegram_link_v1() to authenticated")
   expect(sql).toContain("grant execute on function public.mela_worker_telegram_bot_v1(text,jsonb) to service_role")
   expect(sql).toContain("revoke all on function public.mela_worker_telegram_bot_v1(text,jsonb) from public,anon,authenticated")
   expect(sql).toContain("p_action<>'status'")
   expect(sql).toContain('l.user_id=v_uid')
   expect(sql).toContain('freelancer_id=v_uid')
   expect(sql).not.toMatch(/update\s+public\.payout_requests|insert\s+into\s+public\.payout_requests|update\s+public\.platform_feature_flags/i)
 })
})
