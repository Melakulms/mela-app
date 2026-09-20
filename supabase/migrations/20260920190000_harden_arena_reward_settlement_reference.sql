-- Prevent one external settlement reference from paying multiple Arena cash rewards.
create unique index if not exists arena_rewards_external_ref_uq
on public.arena_rewards(external_ref)
where external_ref is not null;

-- Cash rewards must carry a positive amount.
alter table public.arena_rewards
  drop constraint if exists arena_rewards_cash_amount_chk;

alter table public.arena_rewards
  add constraint arena_rewards_cash_amount_chk
  check (
    reward_type <> 'cash'
    or (cash_amount is not null and cash_amount > 0)
  );
