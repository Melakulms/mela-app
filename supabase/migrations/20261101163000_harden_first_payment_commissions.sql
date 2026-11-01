-- Supersede legacy direct registration commissions; verify the amount and
-- referenced bank receipt before allowing an outgoing commission payout.
create or replace function public.create_invitation_commission(
 p_inviter uuid,p_registered uuid,p_code text,p_registration uuid,p_amount numeric,p_currency text default 'ETB'
) returns public.invitation_commissions
language plpgsql security definer set search_path=''
as $$ begin
 raise exception 'Commission may be issued only after first independently verified paid subscription';
end $$;
create or replace function public.create_invitation_commission_from_registration(
 p_registered_user_id uuid,p_invitation_code text,p_registration_id uuid default null
) returns public.invitation_commissions
language plpgsql security definer set search_path=''
as $$ begin
 raise exception 'Registration creates referral attribution only, not commissions';
end $$;
revoke all on function public.create_invitation_commission(uuid,uuid,text,uuid,numeric,text) from public,anon,authenticated;
revoke all on function public.create_invitation_commission_from_registration(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_invitation_commission(uuid,uuid,text,uuid,numeric,text) to service_role;
grant execute on function public.create_invitation_commission_from_registration(uuid,text,uuid) to service_role;
CREATE OR REPLACE FUNCTION public.mela_record_referral_payout_v1(p_commission_id uuid, p_provider text, p_reference text, p_evidence_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_user uuid:=auth.uid(); v_comm public.invitation_commissions%rowtype;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or (auth.jwt()->>'aal') is distinct from 'aal2'
     or not exists(select 1 from admin.admin_users where user_id=v_user and active)
     or not exists(select 1 from auth.sessions where user_id=v_user and id::text=auth.jwt()->>'session_id' and (not_after is null or not_after>now()))
  then raise exception 'Active MELA admin with MFA is required' using errcode='42501'; end if;
  if not exists(select 1 from public.platform_feature_flags where feature_key='payouts' and enabled)
    then raise exception 'Commission payouts remain disabled'; end if;
  if p_provider not in ('telebirr','dashen','bank')
    or p_reference !~ '^[A-Za-z0-9][A-Za-z0-9-]{5,63}$'
    or length(coalesce(trim(p_evidence_note),'')) not between 20 and 500
  then raise exception 'Bank method, transfer reference, and verification evidence are required'; end if;
  select * into v_comm from public.invitation_commissions where id=p_commission_id for update;
  if v_comm.id is null or v_comm.status<>'pending' then raise exception 'Pending commission required'; end if;
  if not exists (
      select 1 from public.mela_paid_memberships m where m.user_id=v_comm.registered_user_id
         and m.status='active' and m.expires_at>now()
  ) then raise exception 'Verified active paid membership required'; end if;
  if exists (
      select 1 from public.mela_paid_memberships m join mela_payments.orders o on o.id=m.order_id
       where m.user_id=v_comm.registered_user_id and o.status='reversed'
  ) then raise exception 'Refunded membership cannot earn a payout'; end if;
  if not exists (select 1 from public.payout_accounts p
      where p.user_id=v_comm.inviter_user_id and p.active and p.currency='ETB') then
    raise exception 'Verified, active inviter payout account is required';
  end if;
  if exists (select 1 from public.profiles p
      where p.id=v_comm.inviter_user_id and p.role='student'::public.user_role) then
    raise exception 'Student payouts require a separate verified guardian flow';
  end if;
  -- Confirm this commission matches the exact plan and first verified order.
  if not exists (
    select 1
    from public.mela_paid_memberships m
    join public.subscription_plans sp on sp.id=m.plan_id
    join mela_payments.orders o on o.id=m.order_id
    join mela_payments.receipts r on r.verified_order_id=o.id
    where m.user_id=v_comm.registered_user_id
      and m.status='active' and m.expires_at>now()
      and o.status='approved' and r.amount_minor=o.amount_minor
      and (
        (sp.price_minor=5000 and o.amount_minor=5000 and sp.tier='normal'
            and v_comm.amount=20 and v_comm.invitee_tier='free')
        or
        (sp.price_minor=10000 and o.amount_minor=10000 and sp.tier='premium'
            and v_comm.amount=40 and v_comm.invitee_tier='premium')
      )
  ) then raise exception 'First verified Pro/Premium purchase and exact commission value required';
  end if;
  insert into private.mela_referral_payout_records(commission_id,provider,reference,evidence_note,actor_id)
   values(v_comm.id,p_provider,upper(p_reference),trim(p_evidence_note),v_user);
  update public.invitation_commissions set status='paid',paid_at=now()
   where id=v_comm.id and status='pending';
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,details)
   values(v_user,'mela_referral_payout_recorded','invitation_commission',v_comm.id,
     jsonb_build_object('provider',p_provider,'reference',upper(p_reference),'amount',v_comm.amount,'currency',v_comm.currency));
  return jsonb_build_object('status','paid','commission_id',v_comm.id);
end $function$
;
