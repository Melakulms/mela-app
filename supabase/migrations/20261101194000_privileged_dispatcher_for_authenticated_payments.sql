-- Expose only the authenticated command dispatcher, not the private finance schema.
-- The underlying SECURITY DEFINER dispatcher verifies auth.users, current MFA
-- sessions, active admins and payment reviewers for privileged commands.
create or replace function public.payment_command_v1(
 p_action text,p_data jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer set search_path=''
as $$
begin
 if auth.uid() is null
   or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 then raise exception 'Registered MELA account required' using errcode='42501'; end if;
 return mela_payments.command(p_action,p_data);
end $$;
revoke all on function public.payment_command_v1(text,jsonb) from public,anon,authenticated;
grant execute on function public.payment_command_v1(text,jsonb) to authenticated;
