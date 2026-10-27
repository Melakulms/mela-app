-- STAGING ONLY: private learner preparation and session reflection.
-- Self-reported outcomes never confer certificates, mentor ratings or passports.
create table if not exists public.mentorship_session_preparations (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null unique references public.mentorship_sessions(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  goal text not null check(char_length(btrim(goal)) between 3 and 300),
  questions text not null check(char_length(btrim(questions)) between 10 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mentorship_preparations_learner_idx
  on public.mentorship_session_preparations(learner_id);
alter table public.mentorship_session_preparations enable row level security;
revoke all on public.mentorship_session_preparations from public,anon,authenticated;
grant select on public.mentorship_session_preparations to authenticated;
grant insert(session_id,learner_id,goal,questions)
  on public.mentorship_session_preparations to authenticated;
grant update(goal,questions) on public.mentorship_session_preparations to authenticated;
grant delete on public.mentorship_session_preparations to authenticated;

create policy mentorship_preparations_own_read
 on public.mentorship_session_preparations for select to authenticated
 using(learner_id=(select auth.uid()));
create policy mentorship_preparations_own_insert
 on public.mentorship_session_preparations for insert to authenticated
 with check(
  learner_id=(select auth.uid())
  and exists (
    select 1 from public.mentorship_sessions s
    where s.id=mentorship_session_preparations.session_id
      and s.mentee_id=mentorship_session_preparations.learner_id
      and s.status in ('scheduled','completed')
  )
 );
create policy mentorship_preparations_own_update
 on public.mentorship_session_preparations for update to authenticated
 using(learner_id=(select auth.uid()))
 with check(learner_id=(select auth.uid()));
create policy mentorship_preparations_own_delete
 on public.mentorship_session_preparations for delete to authenticated
 using(learner_id=(select auth.uid()));

create or replace function private.guard_mentorship_preparation()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());
begin
  if v_actor is null or v_actor is distinct from new.learner_id then
    raise exception 'only the signed-in learner can prepare this session';
  end if;
  if tg_op='UPDATE' and (
    new.id is distinct from old.id or new.learner_id is distinct from old.learner_id
    or new.session_id is distinct from old.session_id
    or new.created_at is distinct from old.created_at
  ) then raise exception 'session preparation ownership and identity are immutable'; end if;
  if not exists (
    select 1 from public.mentorship_sessions s
    join public.mentorship_requests r on r.id=s.request_id
    join public.mentor_profiles m on m.user_id=s.mentor_id
    where s.id=new.session_id and s.mentee_id=v_actor
      and s.status in ('scheduled','completed') and r.status='accepted'
      and r.mentor_id=s.mentor_id and r.mentee_id=v_actor
      and m.verified and m.active
  ) or not private.user_has_guardian_or_adult_clearance(v_actor) then
    raise exception 'current accepted session and verified learner clearance required';
  end if;
  if tg_op='UPDATE' then new.updated_at=now(); end if;
  return new;
end;
$fn$;
revoke all on function private.guard_mentorship_preparation()
  from public,anon,authenticated;
create trigger trg_guard_mentorship_preparation
before insert or update on public.mentorship_session_preparations
for each row execute function private.guard_mentorship_preparation();

create table if not exists public.mentorship_session_reflections (
  id uuid primary key default extensions.gen_random_uuid(),
  session_id uuid not null unique references public.mentorship_sessions(id) on delete cascade,
  learner_id uuid not null references public.profiles(id) on delete cascade,
  learning_summary text not null check(char_length(btrim(learning_summary)) between 10 and 3000),
  next_step text not null check(char_length(btrim(next_step)) between 3 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists mentorship_reflections_learner_idx
  on public.mentorship_session_reflections(learner_id);
alter table public.mentorship_session_reflections enable row level security;
revoke all on public.mentorship_session_reflections from public,anon,authenticated;
grant select on public.mentorship_session_reflections to authenticated;
grant insert(session_id,learner_id,learning_summary,next_step)
  on public.mentorship_session_reflections to authenticated;
grant delete on public.mentorship_session_reflections to authenticated;
create policy mentorship_reflections_self_read
 on public.mentorship_session_reflections for select to authenticated
 using(learner_id=(select auth.uid()));
create policy mentorship_reflections_self_insert
 on public.mentorship_session_reflections for insert to authenticated with check(
  learner_id=(select auth.uid())
  and exists(select 1 from public.mentorship_sessions s
   where s.id=mentorship_session_reflections.session_id
     and s.mentee_id=mentorship_session_reflections.learner_id
     and s.status='completed' and s.completed_at is not null)
 );
create policy mentorship_reflections_self_delete
 on public.mentorship_session_reflections for delete to authenticated
 using(learner_id=(select auth.uid()));

create or replace function private.guard_mentorship_reflection()
returns trigger language plpgsql security definer set search_path=''
as $fn$
declare v_actor uuid := (select auth.uid());
begin
 if v_actor is null or v_actor is distinct from new.learner_id then
   raise exception 'only the signed-in learner may reflect on their session';
 end if;
 if not exists(
  select 1 from public.mentorship_sessions s
  where s.id=new.session_id and s.mentee_id=v_actor
    and s.status='completed' and s.completed_at is not null
 ) then raise exception 'only genuine completed sessions accept a reflection'; end if;
 return new;
end;
$fn$;
revoke all on function private.guard_mentorship_reflection()
  from public,anon,authenticated;
create trigger trg_guard_mentorship_reflection
before insert on public.mentorship_session_reflections
for each row execute function private.guard_mentorship_reflection();
