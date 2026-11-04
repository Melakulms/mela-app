-- Issue #168: new payment orders require provider AND business/legal launch approval.
-- This deliberately DOES NOT change live feature flags or payout settings.
-- Migration is for reviewed staging validation, not automatic production approval.
--
-- Prior client-accessible RPC: public.payment_command_v1(text,jsonb)
-- The private mela_payments schema is not exposed to authenticated users.
-- Existing-order operations (my_orders, submit, admin_queue, admin_record,
-- admin_reject, admin_reverse, admin_recheck and admin_audit) are preserved.
--
-- This requirement must be reviewed by an authorized administrator against
-- actual registration, legal advice and provider documentation before status
-- can ever be marked complete. Never store sensitive evidence in public git.
insert into public.platform_launch_requirements
  (requirement_key, category, title, requirement_type, required, manual_status)
values (
  'wallet_business_legal',
  'finance',
  'MELA business registration and financial legal approval',
  'manual',
  true,
  'pending'
)
on conflict (requirement_key) do nothing;

create or replace function public.payment_command_v1(
  p_action text,
  p_data jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer
set search_path = ''
as $function$
declare
  v_provider_approved boolean;
  v_business_approved boolean;
begin
  if auth.uid() is null
     or coalesce((auth.jwt()->>'is_anonymous')::boolean, false)
  then
    raise exception 'Registered MELA account required' using errcode='42501';
  end if;

  -- The status of a receiving account does NOT prove that MELA is
  -- legally registered or licensed/authorized for the financial model.
  -- Both checks must be made on every catalog and new-order request.
  if p_action in ('catalog', 'create_order') then
    select exists (
      select 1 from public.platform_launch_requirements r
      where r.requirement_key = 'payments_provider'
        and r.manual_status = 'complete'
        and r.completed_by is not null
        and r.completed_at is not null
        and length(btrim(coalesce(r.evidence_note, ''))) >= 40
    ) into v_provider_approved;

    select exists (
      select 1 from public.platform_launch_requirements r
      where r.requirement_key = 'wallet_business_legal'
        and r.manual_status = 'complete'
        and r.completed_by is not null
        and r.completed_at is not null
        and length(btrim(coalesce(r.evidence_note, ''))) >= 40
    ) into v_business_approved;

    if not (v_provider_approved and v_business_approved) then
      if p_action = 'catalog' then
        -- Do not disclose a receiving account or invite a transfer
        -- when merchant payment launch is not authorized.
        return jsonb_build_object(
          'enabled', false,
          'products', '[]'::jsonb,
          'accounts', '[]'::jsonb,
          'reason', 'Subscription checkout is awaiting provider and legal approval'
        );
      end if;
      raise exception 'New subscription orders are unavailable pending financial-launch approval'
        using errcode='42501';
    end if;
  end if;

  -- Preserve existing bank/reference review, refund/reversal and all
  -- MFA-authorized admin actions in the current private dispatcher.
  return mela_payments.command(p_action, p_data);
end;
$function$;

revoke all on function public.payment_command_v1(text,jsonb)
  from public, anon, authenticated;
grant execute on function public.payment_command_v1(text,jsonb)
  to authenticated;
