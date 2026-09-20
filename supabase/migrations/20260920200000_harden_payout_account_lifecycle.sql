-- A user must not have two active payout destinations at once.
create unique index if not exists payout_accounts_one_active_per_user_uidx
on public.payout_accounts(user_id)
where active = true;

-- Verified accounts may be deactivated, but their verified identity/bank
-- fields remain immutable. Re-activation still requires platform verification.
create or replace function private.guard_payout_account_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.is_admin_user() then
    if coalesce(new.active,false) = true and coalesce(old.active,false) = false then
      raise exception 'Payout account activation requires platform verification.' using errcode='42501';
    end if;

    if coalesce(old.active,false) = true then
      if new.account_name is distinct from old.account_name
         or new.account_number is distinct from old.account_number
         or new.bank_code is distinct from old.bank_code
         or new.bank_name is distinct from old.bank_name
         or new.currency is distinct from old.currency
         or new.user_id is distinct from old.user_id then
        raise exception 'Verified payout account details are locked; deactivate and create a new account or contact support.' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end
$function$;
