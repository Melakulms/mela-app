-- STAGING ONLY, rollback-only. Structural and anonymous/MFA-negative smoke checks.
-- This is not an authenticated participant attendance E2E test.
begin;
do $test$
declare v_denied boolean := false;
begin
 if not (select c.relrowsecurity from pg_catalog.pg_class c
         where c.oid='public.mentorship_group_attendance'::regclass) then
   raise exception 'RLS must be enabled on attendance';
 end if;
 if has_table_privilege('anon','public.mentorship_group_attendance','SELECT')
   or has_table_privilege('anon','public.mentorship_group_attendance','INSERT')
   or has_table_privilege('authenticated','public.mentorship_group_attendance','UPDATE')
   or has_table_privilege('authenticated','public.mentorship_group_attendance','DELETE') then
   raise exception 'unsafe attendance grants';
 end if;
 if (select count(*) from pg_catalog.pg_trigger
    where tgrelid='public.mentorship_group_attendance'::regclass
      and not tgisinternal
      and tgname in ('trg_guard_mentorship_group_attendance',
                     'trg_audit_mentorship_group_attendance'))<>2 then
   raise exception 'review and audit triggers missing';
 end if;
 begin
   set local role anon;
   insert into public.mentorship_group_attendance
     (interest_id,status,explanation,recorded_by)
   values ('00000000-0000-0000-0000-000000000001','reported_present',
     'Rejected anonymous fake group report',
     '00000000-0000-0000-0000-000000000002');
 exception when insufficient_privilege then v_denied := true;
 end;
 reset role;
 if not v_denied then raise exception 'anonymous attendance insert was not denied'; end if;
 v_denied := false;
 begin
   set local role authenticated;
   insert into public.mentorship_group_attendance
     (interest_id,status,explanation,recorded_by)
   values ('00000000-0000-0000-0000-000000000001','reported_present',
     'Rejected signed-in role without MFA identity',
     '00000000-0000-0000-0000-000000000002');
 exception when insufficient_privilege then v_denied := true;
 end;
 reset role;
 if not v_denied then raise exception 'missing-MFA attendance insert was not denied'; end if;
end;
$test$;
rollback;
