// @vitest-environment node
import {readFileSync} from 'node:fs'
import {expect,it} from 'vitest'

const sql=readFileSync(
 new URL('../supabase/migrations/20261104193000_financial_launch_checkout_gate.sql',import.meta.url),
 'utf8'
)

it('creates a separate pending legal/business approval instead of assuming receiving account verification equals launch permission',()=>{
 expect(sql).toContain("'wallet_business_legal'")
 expect(sql).toContain("'pending'")
 expect(sql).toContain('on conflict (requirement_key) do nothing')
 expect(sql).toContain("r.requirement_key = 'payments_provider'")
 expect(sql).toContain("r.requirement_key = 'wallet_business_legal'")
 expect((sql.match(/r.manual_status = 'complete'/g)??[])).toHaveLength(2)
 expect((sql.match(/r.completed_at is not null/g)??[])).toHaveLength(2)
 expect((sql.match(/r.completed_by is not null/g)??[])).toHaveLength(2)
})

it('protects both catalog and direct order creation while leaving settlement/refund routes intact',()=>{
 expect(sql).toContain("p_action in ('catalog', 'create_order')")
 expect(sql).toContain("if p_action = 'catalog' then")
 expect(sql).toContain("'enabled', false")
 expect(sql).toContain("'products', '[]'::jsonb")
 expect(sql).toContain("'accounts', '[]'::jsonb")
 expect(sql).toContain("raise exception 'New subscription orders are unavailable pending financial-launch approval'")
 expect(sql).toContain("return mela_payments.command(p_action, p_data)")
 expect(sql).toContain("grant execute on function public.payment_command_v1(text,jsonb)")
 expect(sql).not.toMatch(/update\s+public\.platform_feature_flags\s+set|update\s+mela_payments\.settings\s+set/i)
})

it('ships with an isolated rollback-only SQL negative-path test',()=>{
 const smoke=readFileSync(new URL('sql/financial_checkout_gate_negative_rollback.sql',import.meta.url),'utf8')
 expect(smoke).toMatch(/(?:^|\\n)begin;/i)
 expect(smoke).toMatch(/rollback;\s*$/i)
 expect(smoke).toContain("SET LOCAL ROLE authenticated")
 expect(smoke).toContain("'catalog'")
 expect(smoke).toContain("'create_order'")
 expect(smoke).toContain("r.requirement_key in ('payments_provider', 'wallet_business_legal')")
})
