create function private.get_ai_course_assignments_admin_v1(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if (select auth.uid()) is null or not private.is_admin_user() then raise exception 'MFA-protected administrator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('course_id',c.id,'title',c.title,'active',coalesce(a.active,false)) order by c.title)
 from public.courses c left join private.mela_ai_course_reviewer_assignments a on a.course_id=c.id and a.user_id=p_user_id
 where exists(select 1 from public.mela_ai_course_lessons l where l.course_id=c.id)),'[]'::jsonb);
end $$;
create function public.get_ai_course_assignments_admin_v1(p_user_id uuid) returns jsonb language sql stable set search_path='' as $$ select private.get_ai_course_assignments_admin_v1(p_user_id); $$;
revoke all on function private.get_ai_course_assignments_admin_v1(uuid),public.get_ai_course_assignments_admin_v1(uuid) from public,anon,authenticated;
grant execute on function private.get_ai_course_assignments_admin_v1(uuid),public.get_ai_course_assignments_admin_v1(uuid) to authenticated;
notify pgrst,'reload schema';

