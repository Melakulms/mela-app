// @vitest-environment node
import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

const sql=readFileSync(
 new URL('../supabase/migrations/20261104193000_financial_launch_checkout_gate.sql',import.meta.url),
 'utf8'
)

it('requires three independent finance release approvals and preserves existing signoffs',()=>{
 expect(sql).toContain("'wallet_business_legal'")
 expect(sql).toContain("'payments_provider'")
 expect(sql).toContain("'legal_review'")
 expect(sql).toMatch(/select count\(\*\) = 3/i)
 expect(sql).toContain("r.manual_status = 'complete'")
 expect(sql).toContain('r.completed_at is not null')
 expect(sql).toContain('r.completed_by is not null')
 expect(sql).toContain('length(btrim(coalesce(r.evidence_note')
 expect((sql.match(/on conflict \(requirement_key\) do nothing/g)??[]).length).toBe(2)
})

it('protects checkout and direct order creation without blocking existing-order recovery',()=>{
 expect(sql).toContain("p_action in ('catalog', 'create_order')")
 expect(sql).toContain("private.mela_financial_launch_approved(), false")
 expect(sql).toContain("if p_action = 'catalog' then")
 expect(sql).toContain("'enabled', false")
 expect(sql).toContain("'products', '[]'::jsonb")
 expect(sql).toContain("'accounts', '[]'::jsonb")
 expect(sql).toContain("raise exception 'New subscription orders are unavailable pending financial-launch approval'")
 expect(sql).toContain('return mela_payments.command(p_action, p_data)')
 expect(sql).toContain('grant execute on function public.payment_command_v1(text,jsonb) to authenticated')
 expect(sql).not.toMatch(/update\s+public\.platform_feature_flags\s+set|update\s+mela_payments\.settings\s+set/i)
})

it('applies the same authorization gate to Telegram /pay and /verify, preserving old order status',()=>{
 expect(sql).toContain('create or replace function private.mela_financial_launch_approved()')
 expect(sql).toContain('revoke all on function private.mela_financial_launch_approved() from public, anon, authenticated')
 expect(sql).toContain('CREATE OR REPLACE FUNCTION public.mela_telegram_order_bot_v1')
 expect(sql).toContain("and coalesce(private.mela_financial_launch_approved(),false);")
 expect(sql).toContain("if p_action='status' then")
 expect(sql).toContain("if not v_enabled then raise exception")
})

it('ships rollback-only staging negative test for client and Telegram routes',()=>{
 const smoke=readFileSync(new URL('sql/financial_checkout_gate_negative_rollback.sql',import.meta.url),'utf8')
 expect(smoke).toContain('begin;')
 expect(smoke).toMatch(/rollback;\s*$/i)
 expect(smoke.toLowerCase()).toContain('set local role authenticated')
 expect(smoke).toContain("'catalog'")
 expect(smoke).toContain("'create_order'")
 expect(smoke).toContain("'health'")
 expect(smoke).toContain("'payments_provider', 'wallet_business_legal', 'legal_review'")
})
