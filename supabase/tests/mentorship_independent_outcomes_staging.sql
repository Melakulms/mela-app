-- STAGING ONLY, rollback-only independent outcome review safety test.
-- Does not establish real MFA admission or evidence validity.
begin;
do $test$
declare v_denied boolean:=false;
begin
 if not (select relrowsecurity from pg_catalog.pg_class
   where oid='public.mentorship_outcome_verifications'::regclass)
   then raise exception 'independent outcomes require RLS';end if;
 if has_table_privilege('anon','public.mentorship_outcome_verifications','SELECT')
   or has_table_privilege('anon','public.mentorship_outcome_verifications','INSERT')
   or has_table_privilege('authenticated','public.mentorship_outcome_verifications','UPDATE')
   or has_table_privilege('authenticated','public.mentorship_outcome_verifications','DELETE')
   then raise exception 'unsafe independent outcome grants';end if;
 if (select count(*) from pg_catalog.pg_trigger
   where tgrelid='public.mentorship_outcome_verifications'::regclass
    and not tgisinternal and tgname in
      ('trg_guard_mentorship_outcome_verification','trg_audit_mentorship_outcome_verification'))<>2
   then raise exception 'outcome guard/audit triggers missing';end if;
 if not exists(select 1 from pg_catalog.pg_policies
   where schemaname='public' and tablename='mentorship_outcome_claims'
   and policyname='mentorship_outcome_admin_independent_read')
   then raise exception 'MFA restricted independent read not present';end if;
 begin
   set local role anon;
   insert into public.mentorship_outcome_verifications
     (claim_id,decision,public_reason,reviewed_by)
   values ('00000000-0000-0000-0000-000000000001',
     'evidence_supported','No anonymous account can independently review evidence.',
     '00000000-0000-0000-0000-000000000002');
 exception when insufficient_privilege then v_denied:=true;
 end;
 reset role;
 if not v_denied then raise exception 'anonymous review was not denied';end if;
 v_denied:=false;
 begin
   set local role authenticated;
   insert into public.mentorship_outcome_verifications
     (claim_id,decision,public_reason,reviewed_by)
   values ('00000000-0000-0000-0000-000000000001',
     'evidence_supported','This unsigned test reviewer has no MFA or identity proof.',
     '00000000-0000-0000-0000-000000000002');
 exception
   when raise_exception then
     if position('MFA independent evidence reviewer required' in sqlerrm)>0 then v_denied:=true;
     else raise; end if;
   when insufficient_privilege then v_denied:=true;
 end;
 reset role;
 if not v_denied then raise exception 'non-MFA review was not denied';end if;
end;
$test$;
rollback;
