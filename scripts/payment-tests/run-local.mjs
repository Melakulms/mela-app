// Isolated PostgreSQL-compatible execution. Never connects to a remote database.
// npm install --prefix /tmp/mela-payment-test-runtime --no-save @electric-sql/pglite@0.3.14
import { PGlite } from '/tmp/mela-payment-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { readFile } from 'node:fs/promises';
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,aud text,role text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;`);
await db.exec(await readFile('supabase/migrations/20261019140354_manual_payment_verification.sql','utf8'));
await db.exec(await readFile('supabase/migrations/20261019142948_cross_bank_payment_references.sql','utf8'));
const results=await db.exec(await readFile('supabase/tests/manual_payments.sql','utf8'));
for(const result of results) if(result.rows?.length) console.log(result.rows);
const crossBankResults=await db.exec(await readFile('supabase/tests/cross_bank_payments.sql','utf8'));
for(const result of crossBankResults) if(result.rows?.length) console.log(result.rows);
const state=await db.query('select (select count(*) from auth.users)::int users, (select count(*) from mela_payments.orders)::int orders, (select enabled from mela_payments.settings) enabled');
console.log('Rollback verified:', state.rows);
await db.close();
