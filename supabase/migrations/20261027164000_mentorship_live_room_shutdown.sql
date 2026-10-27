-- STAGING ONLY: direct mentoring is currently a scheduling/workflow product.
-- Do not accept arbitrary meeting URLs, video rooms or recording references
-- before moderated live-session consent and guardian controls are shipped.

create or replace function private.block_unapproved_live_mentorship()
returns trigger language plpgsql security definer set search_path=''
as $fn$
begin
  if tg_op='INSERT' then
    if new.call_room_id is not null
      or new.video_call_room_id is not null
      or new.recording_url is not null then
      raise exception 'live mentorship calls and recordings are not enabled';
    end if;
  elsif tg_op='UPDATE' then
    if (new.call_room_id is distinct from old.call_room_id
         and new.call_room_id is not null)
      or (new.video_call_room_id is distinct from old.video_call_room_id
         and new.video_call_room_id is not null)
      or (new.recording_url is distinct from old.recording_url
         and new.recording_url is not null) then
      raise exception 'live mentorship calls and recordings are not enabled';
    end if;
  end if;
  return new;
end;
$fn$;
revoke all on function private.block_unapproved_live_mentorship()
 from public,anon,authenticated;

drop trigger if exists trg_block_unapproved_live_mentorship
 on public.mentorship_sessions;
create trigger trg_block_unapproved_live_mentorship
 before insert or update of call_room_id,video_call_room_id,recording_url
 on public.mentorship_sessions
 for each row execute function private.block_unapproved_live_mentorship();
